import {DiagramElement} from "@/types/editorElement.type";
import {PaletteItemType} from "@/types/palette.types";
import {createUuid} from "@/lib/createUuid";
import {snap} from "@/lib/utils";
import {instantiateTemplate} from "@/lib/editor/templateInstance";
import {findTemplateRoot} from "@/lib/editor/templateRoot";
import {transformSelection, type TransformOp} from "@/lib/editor/transformSelection";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {DEFAULT_DASH} from "@/lib/editor/dashArray";

/**
 * Импорт плана устройств: «какой шаблон взять и в какие координаты поставить».
 *
 * Чистый модуль без сторов и без `toast` — как `conturImport`. Решение, что делать с
 * результатом (спросить режим, показать отчёт), принимает вызывающий.
 */

/**
 * Координаты в файле мелкие: шаг сетки чертежа — 4 единицы, у редактора `GRID = 20`.
 * Множитель 5 переводит один в другой, поэтому устройства встают на узлы сетки без
 * подгонки, а схема целиком занимает примерно 1800×1200.
 */
export const SCALE = 5;

/**
 * Пол толщины линии. Своя константа, а не импорт из `conturImport`: там такая же
 * объявлена без `export`. Причина та же — при обзоре «весь лист» линия тоньше
 * половины пикселя пропадает с экрана совсем.
 */
const MIN_STROKE = 0.5;

/**
 * В какую сторону файл считает положительный угол. Ось Y в файле смотрит вниз, как у
 * холста, поэтому `rotation: 90` — по часовой. Если символы на схеме окажутся повёрнуты
 * зеркально, менять здесь, и только здесь.
 */
const ROTATION_OP: TransformOp = "cw";
const COUNTER_ROTATION_OP: TransformOp = ROTATION_OP === "cw" ? "ccw" : "cw";

/** Радиус точки соединения труб — одна единица чертежа. */
const JUNCTION_RADIUS = 1 * SCALE;

export interface DeviceLayoutDevice {
  /** Имя шаблона в палитре: «V», «LS», «UZ». */
  template: string;
  /** Имя устройства на схеме: «V3». */
  name: string;
  /** Узел базы каналов. НЕ уникален: один узел бывает нарисован несколько раз. */
  idNode: string;
  /** ЦЕНТР символа (не угол): так ложатся разрывы труб под клапанами. */
  x: number;
  y: number;
  /** Угол в градусах, кратный 90. Нет поля — без поворота. */
  rotation?: number;
  /** Отражение по горизонтали, до поворота. */
  mirror?: boolean;
}

export interface DeviceLayoutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** В файле необязательна; без неё рендер подставит свою толщину. */
  width?: number;
  /** Цвет обводки «#RRGGBB». Нет поля — цвет темы. */
  color?: string;
  dashed?: boolean;
}

/** Точка соединения труб — закрашенный кружок на пересечении линий. */
export interface DeviceLayoutJunction {
  x: number;
  y: number;
  color?: string;
}

export interface DeviceLayoutFile {
  devices: DeviceLayoutDevice[];
  lines?: DeviceLayoutLine[];
  junctions?: DeviceLayoutJunction[];
}

export interface DeviceLayoutReport {
  /** Сколько устройств было в файле. */
  devices: number;
  /** Сколько из них удалось поставить. */
  placed: number;
  lines: number;
  junctions: number;
  /** Из поставленных: сколько повёрнуто и сколько отражено. */
  rotated: number;
  mirrored: number;
  /** Угол не кратен 90 — устройство поставлено без поворота. «V3 (45°)». */
  unsupportedRotation: string[];
  /** Шаблонов с таким именем в палитре нет — устройства пропущены. `names` — их idNode. */
  missing: {template: string; count: number; names: string[]}[];
  /** Имя шаблона встречается в палитре несколько раз — взят первый. */
  ambiguous: {template: string; count: number}[];
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isColor = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Узнаёт формат по ПОЛЯМ, а не по наличию ключа: файл с пустым `devices` ещё ничего не
 * доказывает, а перепутать диалект — значит молча создать мусор вместо схемы.
 */
export const isDeviceLayoutFile = (json: unknown): json is DeviceLayoutFile => {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const devices = (json as {devices?: unknown}).devices;
  if (!Array.isArray(devices) || devices.length === 0) return false;
  const first = devices[0] as Record<string, unknown> | undefined;
  return !!first
    && typeof first.template === "string"
    && isFiniteNumber(first.x)
    && isFiniteNumber(first.y);
};

/**
 * Индекс шаблонов палитры по имени.
 *
 * Фильтр `type === "custom"` обязателен: в палитре лежат ещё и статические элементы
 * (`src/constants/palette.ts`), у которых `template` нет вовсе. Сравнение точное —
 * подстрочный `filterPalette` здесь не годится, по нему «V» совпало бы с «VN», «VH» и «VC».
 */
const buildTemplateIndex = (paletteItems: PaletteItemType[]): Map<string, PaletteItemType[]> => {
  const index = new Map<string, PaletteItemType[]>();
  for (const item of paletteItems) {
    if (item.type !== "custom" || !item.template?.length) continue;
    for (const key of new Set([item.name, item.name.trim().toLowerCase()])) {
      const bucket = index.get(key);
      if (bucket) bucket.push(item);
      else index.set(key, [item]);
    }
  }
  return index;
};

/**
 * Операции над устройством: сначала отражение, потом поворот — обычная семантика
 * вставки блока. Угол не кратный 90 модель выразить не может (поворот здесь — пересчёт
 * геометрии, а не поле `rotate`, см. `transformSelection`), такой возвращается `null`.
 */
const deviceOps = (device: DeviceLayoutDevice): TransformOp[] | null => {
  const ops: TransformOp[] = device.mirror === true ? ["flipH"] : [];

  const raw = isFiniteNumber(device.rotation) ? device.rotation : 0;
  const deg = ((raw % 360) + 360) % 360;
  if (deg % 90 !== 0) return null;

  const turns = deg / 90;
  // Три шага в одну сторону — это один в другую: меньше пересчётов и снапов.
  if (turns === 3) ops.push(COUNTER_ROTATION_OP);
  else for (let i = 0; i < turns; i++) ops.push(ROTATION_OP);

  return ops;
};

/**
 * Ставит экземпляр так, чтобы ЦЕНТР его габарита пришёлся в `(cx, cy)`.
 *
 * Координаты файла — центр символа, а `instantiateTemplate` ставит в точку левый
 * верхний угол: без этой правки каждый клапан уезжал на полсимвола вправо-вниз от
 * разрыва трубы, а после поворота неквадратного шаблона — ещё и по-разному.
 * Угол при этом кладётся на сетку, как у шаблона, поставленного из палитры.
 */
const placeCentre = (
  instance: DiagramElement[],
  rootKey: string,
  cx: number,
  cy: number,
): DiagramElement[] => {
  const root = instance.find(el => el.key === rootKey);
  if (!root) return instance;

  const b = getElementBoundsRendered(root, instance);
  if (!Number.isFinite(b.minX) || !Number.isFinite(b.minY)) return instance;

  const dx = snap(cx - (b.maxX - b.minX) / 2) - b.minX;
  const dy = snap(cy - (b.maxY - b.minY) / 2) - b.minY;
  if (!dx && !dy) return instance;

  return instance.map(el => {
    if (el.key !== rootKey) return el;
    // У группы позиция — в базе, дети локальны и едут сами. У одиночного элемента
    // живая позиция ещё и в overrides состояний (и концами у линии) — сдвигаем всё.
    if (el.type === "group") return {...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy} as DiagramElement;
    return shiftElementPositions(el, dx, dy);
  });
};

/** Поля, общие для элементов, которые импорт создаёт сам (не из шаблона). */
const ownElementBase = (sceneId: number | null) => ({
  id: null,
  key: createUuid(),
  // Элементы кладёт addImportedElements, а он ничего не перепривязывает —
  // корень сцены проставляем сами.
  parentId: sceneId,
  parentKey: String(sceneId),
  children: [],
  composition: [],
  scripts: [],
  bindings: [],
  properties: [],
  states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
});

/** Линия чертежа. Эталон полей — ветка `line` в `addElementAt`. */
const buildLine = (line: DeviceLayoutLine, sceneId: number | null): DiagramElement => {
  const x1 = line.x1 * SCALE;
  const y1 = line.y1 * SCALE;
  const x2 = line.x2 * SCALE;
  const y2 = line.y2 * SCALE;

  return {
    ...ownElementBase(sceneId),
    type: "line",
    x1, y1, x2, y2,
    // Точка «тела» линии — её середина: так её ставит addElementAt, и так её
    // двигает перетаскивание. Габарит линии считается по концам, поэтому w/h
    // оставляем такими же, как у линии, созданной руками.
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    w: 80,
    h: 80,
    // Толщину масштабируем вместе с координатами; если её в файле нет — поле не
    // пишем вовсе, чтобы рендер подставил своё значение по умолчанию.
    ...(isFiniteNumber(line.width)
      ? {strokeWidth: Math.max(line.width * SCALE, MIN_STROKE)}
      : {}),
    // Обводку линия берёт из strokeColor; `color` у фигур — заливка, рендер линии
    // его не читает. Та же раскладка, что в conturImport.
    ...(isColor(line.color) ? {strokeColor: line.color} : {}),
    ...(line.dashed === true ? {strokeDasharray: DEFAULT_DASH} : {}),
  } as DiagramElement;
};

/**
 * Точка соединения — закрашенный круг. У круга в модели `x/y` — левый верхний угол
 * габарита, а файл даёт центр; тройка radius/w/h согласована, как у круга из палитры.
 * Без снапа: точка обязана совпасть с концами линий, а они на сетку не кладутся.
 */
const buildJunction = (junction: DeviceLayoutJunction, sceneId: number | null): DiagramElement => {
  const r = JUNCTION_RADIUS;
  const color = isColor(junction.color) ? junction.color : undefined;

  return {
    ...ownElementBase(sceneId),
    type: "circle",
    x: junction.x * SCALE - r,
    y: junction.y * SCALE - r,
    w: 2 * r,
    h: 2 * r,
    radius: r,
    // Без цвета — цвета темы: заливка круга по умолчанию полупрозрачная серая.
    ...(color ? {color, strokeColor: color} : {}),
  } as DiagramElement;
};

export const buildDeviceLayout = (
  file: DeviceLayoutFile,
  paletteItems: PaletteItemType[],
  sceneId: number | null,
): {elements: DiagramElement[]; report: DeviceLayoutReport} => {
  const index = buildTemplateIndex(paletteItems);
  const elements: DiagramElement[] = [];

  const missing = new Map<string, {count: number; names: string[]}>();
  const ambiguous = new Map<string, number>();
  const unsupportedRotation: string[] = [];
  let placed = 0;
  let rotated = 0;
  let mirrored = 0;

  for (const device of file.devices) {
    const found = index.get(device.template)
      ?? index.get(device.template.trim().toLowerCase());
    // Имя компонента на схеме — узел базы каналов («TANK1.V1»), а не короткое «V1»:
    // короткое повторяется в каждом танке и ничего не говорит ни в «Слоях», ни в отчёте.
    const title = device.idNode?.trim() || device.name;

    if (!found?.length) {
      const miss = missing.get(device.template) ?? {count: 0, names: []};
      miss.count += 1;
      miss.names.push(title);
      missing.set(device.template, miss);
      continue;
    }

    // Уникальность имён в палитре нигде не проверяется, поэтому дубль — штатная
    // ситуация: берём первый и сообщаем об этом в отчёте.
    if (found.length > 1) {
      ambiguous.set(device.template, (ambiguous.get(device.template) ?? 0) + 1);
    }

    let ops = deviceOps(device);
    if (!ops) {
      unsupportedRotation.push(`${title} (${device.rotation}°)`);
      ops = device.mirror === true ? ["flipH"] : [];
    }

    // Каждый экземпляр получает СВОЙ набор ключей внутри instantiateTemplate —
    // общий keyMap на всю пачку схлопнул бы 15 копий шаблона «V» в одну.
    // Ставим в начало координат: поворот и отражение считаются вокруг габарита,
    // а в точку файла экземпляр переносит placeCentre уже в конечном виде.
    let instance = instantiateTemplate(found[0].template!, {
      x: 0,
      y: 0,
      sceneId,
      // label при сохранении становится `name` компонента, а по нему автопривязка ищет
      // объект в базе каналов (`TANK1.V1` → `…TANK1.V1.ST`, контракт
      // docs/contract/2026-09-22-autobind-contract.md). Запасное `name` — если idNode пуст.
      // Если корень шаблона — прямоугольник без своего `text`, фолбэк ShapeElement
      // напечатает это название прямо на фигуре (см. план, ловушка 7).
      label: title,
      // Узел базы каналов. Своё поле переживает сохранение: buildBaseImage работает
      // по чёрному списку и всё незнакомое укладывает в states[].image.
      extra: {idNode: device.idNode},
    });

    // Корень экземпляра — тот, что висит на сцене (instantiateTemplate проставил ему
    // parentKey сцены), а не findTemplateRoot: тот ищет `parentKey == null`.
    const rootKey = (instance.find(el => el.parentKey === String(sceneId))
      ?? findTemplateRoot(instance)
      ?? instance[0]).key;

    for (const op of ops) {
      instance = transformSelection(instance, [rootKey], op, snap);
    }
    if (ops.includes("flipH")) mirrored += 1;
    if (ops.some(op => op !== "flipH")) rotated += 1;

    elements.push(...placeCentre(instance, rootKey, device.x * SCALE, device.y * SCALE));
    placed += 1;
  }

  const lines = file.lines ?? [];
  for (const line of lines) {
    elements.push(buildLine(line, sceneId));
  }

  // После линий: точка соединения рисуется поверх труб, которые она соединяет.
  const junctions = (file.junctions ?? [])
    .filter(j => isFiniteNumber(j?.x) && isFiniteNumber(j?.y));
  for (const junction of junctions) {
    elements.push(buildJunction(junction, sceneId));
  }

  return {
    elements,
    report: {
      devices: file.devices.length,
      placed,
      lines: lines.length,
      junctions: junctions.length,
      rotated,
      mirrored,
      unsupportedRotation,
      missing: [...missing.entries()]
        .map(([template, v]) => ({template, count: v.count, names: v.names}))
        .sort((a, b) => b.count - a.count),
      ambiguous: [...ambiguous.entries()].map(([template, count]) => ({template, count})),
    },
  };
};
