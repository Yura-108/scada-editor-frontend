import {createUuid} from "@/lib/createUuid";

/**
 * Приведение выгрузки CONTUR (`visualization_export_hmi*.json`) к модели редактора.
 *
 * Работает ДО `importElementsFromJson`: тот раздаёт новые ключи, привязывает элементы к
 * сцене и пишет их в стор, и знание о чужом формате ему ни к чему. Здесь — только
 * перевод полей и координат, на входе и на выходе сырые записи.
 *
 * Расхождения, ради которых модуль существует (подробности — `docs/contur/CONTUR_IMPORT_PLAN.md`):
 *  - имена визуальных полей (`stroke_width`, `font_size`, `borderColor`);
 *  - у круга `x, y` — центр, у нас — левый верхний угол габарита;
 *  - рамка техобъекта рисуется самой группой, а наш `GroupNode` невыделенную группу не
 *    рисует вовсе;
 *  - толщина линий приходит в пунктах PDF и уходит в доли пикселя.
 */

/**
 * Пол по толщине линии.
 *
 * `stroke_width` — пункты PDF прямо из чертежа: медиана 0.71, минимум 0.057 на обоих
 * контрольных листах. При зуме «весь лист A0» (около 0.35) это уводит линию к 0.25 px, и
 * чертёж бледнеет до нечитаемости. Если пола окажется мало — следующий шаг не увеличивать
 * его, а отключить масштабирование обводки у линий чертежа (hairline, как в CAD).
 */
const MIN_STROKE = 0.5;

/** Толщина и штрих рамки техобъекта — своих значений CONTUR для них не передаёт. */
const FRAME_STROKE_WIDTH = 1.5;
const FRAME_DASH = "6 4";

export type ConturImportStats = {
  /** Техобъекты, ставшие группами. */
  groups: number;
  /** Линии перерисованного чертежа — вместе с рамкой листа. */
  lines: number;
  /** Из них рамка чертежа и разлиновка штампа (`frame: true`). */
  frameLines: number;
  /** Кружки сопоставленных устройств. */
  circles: number;
  /** Подписи устройств (`text` без `contour` и без `drawing`). */
  labels: number;
  /** Надписи самого чертежа (`text` с `drawing: true`) — обозначения Eplan, штамп. */
  drawingTexts: number;
  /** Имена техобъектов (`text` с `contour: true`). */
  contourNames: number;
  /** Рамки техобъектов, пришедшие из файла прямоугольником (`contour: true`). */
  contourFrames: number;
  /** Прямоугольники рамок, добавленные нами (у групп, где своей рамки нет). */
  frames: number;
  /** Служебные элементы с данными листа (`contur_meta`) — на холсте не рисуются. */
  meta: number;
  /** Сколько элементов уходит в импорт — вместе с рамками и служебными. */
  total: number;
  /** Связи «родитель ↔ ребёнок», которые пришлось достроить. В норме 0. */
  repairedLinks: number;
};

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Похоже ли содержимое на выгрузку CONTUR.
 *
 * Проверяем по полям, которых нет ни у одного нашего элемента. Не совпало — файл уходит в
 * импорт как есть, прежнее поведение кнопки «Импорт» сохраняется.
 */
export const isConturExport = (raw: unknown[]): boolean =>
  raw.some(el =>
    !!el && typeof el === "object" &&
    ("stroke_width" in el || "contour" in el || "tech_object" in el || "lua_name" in el
      // Признаки состава от 19.08.2026: служебный элемент с данными листа и смысловая
      // метка линии. Держим их в детекторе на случай, если CONTUR когда-нибудь уберёт
      // `stroke_width` (толщины уже квантованы) — режим нормализации терять нельзя.
      || "contur_meta" in el || "contur_color" in el),
  );

/**
 * Служебный элемент с данными листа: трубопроводы, связи, точки сопряжения, программы
 * операций. Придуман CONTUR, потому что в плоском массиве фигур этим данным места нет,
 * а вторым файлом слать хуже — файлы разъезжаются.
 *
 * Фигурой не является (`visible: false`, нулевой габарит) и на холст не попадает:
 * рендер пропускает `visible === false`. Импортируем, а не выбрасываем, ради двух
 * ссылок от фигур внутрь него — `pipeline_id` у синей линии и `operation_id`
 * в `contur_states` у кружка.
 */
export const isConturMeta = (el: Raw): boolean =>
  el.contur_meta === true || String(el.type ?? "") === "meta";

/** Один элемент: имена полей и координаты. */
const normalizeOne = (el: Raw): Raw => {
  const type = String(el.type ?? "");

  // Данные листа, а не фигура: переводить в нём нечего. Габарит и `visible` проставляем
  // жёстко — по ним рендер и рамка выделения его пропускают, каким бы ни пришёл файл.
  if (isConturMeta(el)) return {...el, visible: false, w: 0, h: 0};

  const out: Raw = {...el};

  // Толщина линии: наш рендер читает strokeWidth (ShapeElement), CONTUR шлёт пункты PDF.
  const strokeWidth = num(el.stroke_width);
  if (strokeWidth !== null) {
    out.strokeWidth = Math.max(strokeWidth, MIN_STROKE);
    delete out.stroke_width;
  }

  // Кегль: Arial 8 у подписей устройств, 10 у имён контуров.
  const fontSize = num(el.font_size);
  if (fontSize !== null) {
    out.fontSize = fontSize;
    delete out.font_size;
  }

  // `color` у CONTUR — смысловая метка ("blue" — труба, "red" — контур устройства), а у
  // нас это ЗАЛИВКА фигуры. Переиспользовать имя нельзя: метка однажды окажется цветом.
  // Значение сохраняем — по нему делается фильтр «скрыть контуры устройств».
  const conturColor = str(el.color);
  if (conturColor) {
    out.contur_color = conturColor;
    delete out.color;
  }

  // `borderColor` означает разное у разных типов, одного общего переименования нет.
  const border = str(el.borderColor);
  if (border) {
    if (type === "text") {
      // Цвет САМОЙ строки: имя контура рисуется цветом своего контура. Текст берёт
      // `color || textColor || дефолт` и `strokeColor` не читает вовсе.
      out.textColor = border;
    } else if (type !== "group") {
      out.strokeColor = border;
    }
    // group: `borderColor` — уже наше имя поля у GroupElement, оставляем как есть.
  }

  // Круг: у CONTUR `x, y` — центр, у нас — левый верхний угол габарита (центр = x + radius).
  // Без этой правки каждый кружок уезжает вправо-вниз ровно на свой радиус.
  if (type === "circle") {
    const r = num(el.radius);
    const x = num(el.x);
    const y = num(el.y);
    if (r !== null && x !== null && y !== null) {
      out.x = x - r;
      out.y = y - r;
      out.w = 2 * r;
      out.h = 2 * r;
    }
  }

  return out;
};

/**
 * Прямоугольник-рамка техобъекта, первым ребёнком своей группы.
 *
 * Рамкой по контракту служит сама группа (заливка плюс пунктирная обводка), но `GroupNode`
 * рисует подложку прозрачной и обводит её только когда группа выделена или активна — то есть
 * невыделенная рамка невидима. Материализуем её обычным элементом: он рисуется штатной
 * веткой `ShapeElement`, правки рендера холста не нужно.
 *
 * Второй эффект важнее первого: `recomputeAncestorBounds` подгоняет габарит группы под её
 * детей, и без этого прямоугольника рамка схлопнулась бы до скопления кружков при первом же
 * перетаскивании устройства. Прямоугольник входит в состав детей и держит границу.
 */
const buildFrame = (group: Raw): Raw => ({
  id: null,
  key: createUuid(),
  type: "rectangle",
  parentKey: group.key,
  parentId: null,
  // Локальные координаты: дети группы отсчитываются от её левого верхнего угла.
  x: 0,
  y: 0,
  w: num(group.w) ?? 0,
  h: num(group.h) ?? 0,
  bg: group.bg,
  strokeColor: group.borderColor,
  strokeWidth: FRAME_STROKE_WIDTH,
  strokeDasharray: group.borderStyle === "dashed" ? FRAME_DASH : "",
  // Пусто намеренно: ветка прямоугольника рисует `label` текстом по центру фигуры, и
  // имя техобъекта задвоилось бы поверх собственной подписи контура.
  label: "",
  children: [],
  composition: [],
  scripts: [],
  bindings: [],
  properties: [],
  states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
  tech_object: group.tech_object,
  /** Признак «это рамка, а не фигура пользователя» — на случай фильтров и повторного экспорта. */
  contur_frame: true,
});

/**
 * Достраивает недостающую сторону связи «родитель ↔ ребёнок».
 *
 * На присланных файлах обе стороны на месте (проверено, расхождений ноль), но проверка
 * дешёвая, а цена пропуска высокая: холст обходит детей по массиву `children` родителя, а не
 * по `parentKey`, поэтому ребёнок с односторонней связью не отрисуется вообще.
 *
 * Возвращает число починок — оно уходит в статистику и в предупреждение пользователю.
 */
const repairLinks = (elements: Raw[]): number => {
  const byKey = new Map<string, Raw>();
  for (const el of elements) {
    const key = str(el.key);
    if (key) byKey.set(key, el);
  }

  let repaired = 0;

  // Ребёнок знает родителя, родитель ребёнка — нет.
  for (const el of elements) {
    const key = str(el.key);
    const parentKey = str(el.parentKey);
    if (!key || !parentKey) continue;

    const parent = byKey.get(parentKey);
    if (!parent) continue;

    const children = Array.isArray(parent.children) ? (parent.children as string[]) : [];
    if (!children.includes(key)) {
      parent.children = [...children, key];
      repaired += 1;
    }
  }

  // Родитель знает ребёнка, ребёнок родителя — нет.
  for (const el of elements) {
    const key = str(el.key);
    if (!key || !Array.isArray(el.children)) continue;

    for (const childKey of el.children as string[]) {
      const child = byKey.get(childKey);
      if (child && str(child.parentKey) !== key) {
        child.parentKey = key;
        repaired += 1;
      }
    }
  }

  return repaired;
};

/**
 * Выгрузка CONTUR → записи, готовые для `importElementsFromJson`.
 *
 * Не привязывает координаты к сетке: чертёж должен лечь точка в точку, а шаг сетки (20)
 * растащил бы отрезки длиной в единицы пунктов.
 */
export const normalizeConturElements = (raw: Raw[]): {elements: Raw[]; stats: ConturImportStats} => {
  const normalized = raw.map(normalizeOne);

  const stats: ConturImportStats = {
    groups: 0, lines: 0, frameLines: 0, circles: 0, labels: 0, drawingTexts: 0,
    contourNames: 0, contourFrames: 0, frames: 0, meta: 0,
    total: 0, repairedLinks: 0,
  };

  const frames: Raw[] = [];

  const byKey = new Map<string, Raw>();
  for (const el of normalized) {
    const key = str(el.key);
    if (key) byKey.set(key, el);
  }

  for (const el of normalized) {
    if (isConturMeta(el)) {
      stats.meta += 1;
      continue;
    }

    switch (String(el.type ?? "")) {
      case "group": {
        stats.groups += 1;
        const children = Array.isArray(el.children) ? (el.children as string[]) : [];
        // С состава от 19.08.2026 рамку кладёт сам CONTUR — первым ребёнком, локальными
        // (0, 0) размером с группу (`INTEGRATION`, §7.1). Своя добавляется только там, где
        // её нет: иначе у каждого техобъекта окажется две рамки, одна поверх другой.
        const first = byKey.get(children[0] ?? "");
        if (String(first?.type ?? "") === "rectangle") break;

        const frame = buildFrame(el);
        frames.push(frame);
        // Первым ребёнком: `GroupNode` рисует состав по порядку массива, и рамка обязана
        // оказаться под устройствами, а не поверх них.
        el.children = [frame.key as string, ...children];
        break;
      }
      case "line":
        stats.lines += 1;
        // Рамка чертежа и разлиновка штампа листа: тот же `line`, но не трубопровод и не
        // контур устройства — считаем отдельно, чтобы числа приёмки сходились с CONTUR.
        if (el.frame === true) stats.frameLines += 1;
        break;
      case "circle":
        stats.circles += 1;
        break;
      case "rectangle":
        // Рамка техобъекта из файла (раньше приезжала четырьмя линиями, теперь фигурой).
        if (el.contour === true) stats.contourFrames += 1;
        break;
      case "text":
        // Три вида текста: имя техобъекта (`contour`), надпись самого чертежа (`drawing`)
        // и наша подпись устройства — без обоих полей.
        if (el.contour === true) stats.contourNames += 1;
        else if (el.drawing === true) stats.drawingTexts += 1;
        else stats.labels += 1;
        break;
    }
  }

  const elements = [...normalized, ...frames];

  stats.frames = frames.length;
  stats.repairedLinks = repairLinks(elements);
  stats.total = elements.length;

  return {elements, stats};
};
