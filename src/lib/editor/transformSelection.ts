import {DiagramElement, LeafElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {getAbsoluteRenderedPos} from "@/lib/editor/getAbsoluteRenderedPos";
import {parseCurvePoints} from "@/lib/editor/curvePoints";
import {measureText} from "@/lib/editor/measureText";

/**
 * Поворот на 90° и отражения выделения — **пересчётом геометрии**, а не полем `rotate`.
 *
 * Почему так. Свободный угол в модели есть только у «коробочных» типов, и то на уровне
 * рендера: `rotation` Konva крутит узел вокруг его начала, а `rotatedBoxBounds` в расчёте
 * границ — вокруг центра, и уже это расходится. Хуже другое: вся арифметика абсолютных
 * координат (`getAbsoluteRenderedPos` — сумма x/y по цепочке `parentKey`) угла не знает.
 * Поверни мы группу полем `rotate`, и у её детей разъедутся подсветка наведения,
 * мульти-drag, направляющие и пересчёт рамок предков.
 *
 * Поэтому здесь честная геометрия: у линии переезжают концы, у кривой и полигона — точки,
 * у дуги — углы, у группы рекурсивно пересчитываются локальные координаты детей. Всё
 * остаётся на сетке, сериализация и undo работают без единой правки.
 *
 * Чего этот подход не делает: **текст не поворачивается**, он только переезжает. Повернуть
 * глифы можно лишь рендером (`rotation`), а это ровно та зависимость, которой мы избегаем.
 * На схемах подписи обычно и держат горизонтальными. Переезжает он при этом по СВОЕМУ
 * измеренному габариту (`measureText`), а размер и режим переноса не трогаются вовсе —
 * см. ветку `text` в `geometryPatch`.
 */
export type TransformOp = "cw" | "ccw" | "flipH" | "flipV";

/** Меняет ли операция местами ширину и высоту. */
const swapsSides = (op: TransformOp) => op === "cw" || op === "ccw";

interface Size {
  w: number;
  h: number;
}

interface Box extends Size {
  x: number;
  y: number;
}

/**
 * Точка внутри контейнера `c` после операции.
 *
 * Ось Y направлена вниз, поэтому «по часовой» — это `(dx, dy) → (-dy, dx)`: точка справа
 * уезжает вниз. Формулы уже приведены к началу контейнера, отдельного переноса не нужно.
 */
const transformPoint = (px: number, py: number, c: Size, op: TransformOp): [number, number] => {
  switch (op) {
    case "cw":    return [c.h - py, px];
    case "ccw":   return [py, c.w - px];
    case "flipH": return [c.w - px, py];
    case "flipV": return [px, c.h - py];
  }
};

/** Габарит внутри контейнера: тот же перенос, что у точки, плюс обмен сторон при повороте. */
const transformBox = (b: Box, c: Size, op: TransformOp): Box => {
  switch (op) {
    case "cw":    return {x: c.h - (b.y + b.h), y: b.x,                   w: b.h, h: b.w};
    case "ccw":   return {x: b.y,               y: c.w - (b.x + b.w),     w: b.h, h: b.w};
    case "flipH": return {x: c.w - (b.x + b.w), y: b.y,                   w: b.w, h: b.h};
    case "flipV": return {x: b.x,               y: c.h - (b.y + b.h),     w: b.w, h: b.h};
  }
};

/** Угол в [0, 360). */
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Начало дуги после операции. Раствор (`angle`) не меняется никогда — меняется то,
 * откуда его отсчитывать: поворот добавляет ±90°, а отражение переворачивает
 * направление обхода, поэтому новое начало — это отражённый КОНЕЦ дуги.
 */
const transformArcStart = (start: number, sweep: number, op: TransformOp): number => {
  switch (op) {
    case "cw":    return norm360(start + 90);
    case "ccw":   return norm360(start - 90);
    case "flipH": return norm360(180 - (start + sweep));
    case "flipV": return norm360(-(start + sweep));
  }
};

/** Геометрические поля, которые операция трогает (для отбора в overrides состояний). */
const GEOMETRY_KEYS = ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "points", "rotate"] as const;

type Geometry = Record<string, unknown>;

/**
 * Новые значения геометрии одного «слоя» элемента (база или overrides одного состояния).
 *
 * `eff` — эффективная геометрия слоя (база, поверх неё overrides), `container` — система
 * координат, в которой живут `x/y` элемента, `delta` — перенос из координат родителя в
 * координаты контейнера (для верхнего уровня контейнер — рамка выделения, и она в общем
 * случае начинается не там, где родитель).
 */
const geometryPatch = (
  type: string,
  eff: Geometry,
  container: Size,
  delta: {x: number; y: number},
  outShift: {x: number; y: number},
  op: TransformOp,
  /** Габарит текста — ОДИН на элемент, не по слоям. Зачем так, см. ветку `text`. */
  textSize: Size | undefined,
): Geometry => {
  const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  const w = num(eff.w);
  const h = num(eff.h);
  const box: Box = {x: num(eff.x) + delta.x, y: num(eff.y) + delta.y, w, h};
  const nb = transformBox(box, container, op);

  const patch: Geometry = {
    x: nb.x - delta.x + outShift.x,
    y: nb.y - delta.y + outShift.y,
    w: nb.w,
    h: nb.h,
  };

  // Линия: геометрия — это концы, и они лежат в координатах РОДИТЕЛЯ (узел линии стоит
  // в нуле). Переносим их так же, как бокс, и пересчитываем x/y (середина) и габарит.
  if (type === "line") {
    const [nx1, ny1] = transformPoint(num(eff.x1) + delta.x, num(eff.y1) + delta.y, container, op);
    const [nx2, ny2] = transformPoint(num(eff.x2) + delta.x, num(eff.y2) + delta.y, container, op);
    patch.x1 = nx1 - delta.x + outShift.x;
    patch.y1 = ny1 - delta.y + outShift.y;
    patch.x2 = nx2 - delta.x + outShift.x;
    patch.y2 = ny2 - delta.y + outShift.y;
    patch.x = ((nx1 + nx2) / 2) - delta.x + outShift.x;
    patch.y = ((ny1 + ny2) / 2) - delta.y + outShift.y;
    patch.w = Math.abs(nx2 - nx1);
    patch.h = Math.abs(ny2 - ny1);
    return patch;
  }

  // Полигон и кривая: точки локальны относительно x/y элемента, поэтому их контейнер —
  // СОБСТВЕННЫЙ габарит элемента, а не общий.
  if (type === "polygon" || type === "curve") {
    const raw = type === "curve"
      ? parseCurvePoints(eff.points)
      : (Array.isArray(eff.points) ? (eff.points as number[]) : null);

    if (raw) {
      const own: Size = {w, h};
      const next: number[] = [];
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const [px, py] = transformPoint(raw[i], raw[i + 1], own, op);
        next.push(px, py);
      }
      patch.points = next;
    }
    return patch;
  }

  // Текст: глифы не поворачиваются, элемент только переезжает — значит `w/h/autoWidth`
  // трогать нельзя. Раньше общая ветка меняла стороны местами, и `w` состояния с
  // фиксированной шириной переписывалась на `h` — а `h` у текста всегда ископаемые 80 из
  // `addElementAt`. Текст начинал переноситься по словам в 80px, причём только в тех
  // состояниях, где `w` лежит в overrides: остальные оставались auto-width.
  //
  // Считаем по НАСТОЯЩЕМУ габариту (`w/h` из модели описывают не то, что нарисовано),
  // и — важно — по ОДНОМУ на весь элемент, а не по габариту каждого слоя. `ccw` и
  // `flipH` зависят от ширины, а ширина у слоёв разная: состояние, где ручкой задали
  // `w: 200`, и состояние в авторежиме до операции рисуют одну и ту же подпись в одной
  // и той же точке (текст прижат влево), но отразились бы относительно разных коробок и
  // разъехались бы на сотню единиц. Совпадавшие состояния обязаны совпадать и после.
  if (type === "text") {
    const size = textSize ?? {w, h};
    const real = transformBox({x: box.x, y: box.y, w: size.w, h: size.h}, container, op);
    return {
      x: real.x - delta.x + outShift.x,
      y: real.y - delta.y + outShift.y,
    };
  }

  // Дуга: габарит квадратный (2r × 2r), меняются только углы.
  if (type === "arc") {
    patch.rotate = transformArcStart(num(eff.rotate), num(eff.angle, 90), op);
    return patch;
  }

  return patch;
};

/** Есть ли в объекте хоть одно геометрическое поле (иначе overrides трогать незачем). */
const hasGeometry = (obj: Geometry | undefined): boolean =>
  !!obj && GEOMETRY_KEYS.some(k => obj[k] !== undefined);

/**
 * Патчит элемент и, если это контейнер, рекурсивно его состав.
 *
 * База и overrides КАЖДОГО состояния пересчитываются независимо: у листа живая позиция
 * лежит в overrides текущего состояния (так пишет `updateElementVisual`), а у другого
 * состояния она может быть своей. Записать во все состояния один результат значило бы
 * схлопнуть их в одну позицию.
 */
const patchElement = (
  el: DiagramElement,
  container: Size,
  delta: {x: number; y: number},
  /** Сдвиг результата — только для верхнего уровня (возврат рамки к прежнему центру).
   *  Дети едут вместе с родителем, им он не нужен. */
  outShift: {x: number; y: number},
  op: TransformOp,
  byKey: Record<string, DiagramElement>,
  patched: Map<string, DiagramElement>,
): void => {
  const base = el as unknown as Geometry;
  const rendered = getRenderedElement(el) as unknown as Geometry;
  const type = String(el.type ?? "");

  // Габарит текста меряем по тому слою, который сейчас на экране, и применяем ко всем:
  // так операция сдвигает все состояния одинаково (см. ветку `text` в geometryPatch).
  const textSize = type === "text"
    ? measureText(rendered as unknown as Partial<LeafElement>)
    : undefined;

  const next = {...el} as unknown as Geometry;
  Object.assign(next, geometryPatch(type, base, container, delta, outShift, op, textSize));

  const states = (el.states ?? []).map(state => {
    if (!hasGeometry(state.overrides as Geometry | undefined)) return state;
    const eff = {...base, ...(state.overrides as Geometry)};
    const full = geometryPatch(type, eff, container, delta, outShift, op, textSize);
    // В overrides возвращаем только те ключи, что там были: остальное живёт в базе.
    const overrides = {...(state.overrides as Geometry)};
    for (const key of GEOMETRY_KEYS) {
      if (overrides[key] !== undefined && full[key] !== undefined) overrides[key] = full[key];
    }
    return {...state, overrides} as typeof state;
  });

  (next as Record<string, unknown>).states = states;
  patched.set(el.key, next as unknown as DiagramElement);

  if (type !== "group") return;

  // Дети живут в координатах группы, поэтому их контейнер — её СТАРЫЙ габарит, а переноса
  // между системами координат нет.
  const own: Size = {
    w: typeof rendered.w === "number" ? rendered.w : 0,
    h: typeof rendered.h === "number" ? rendered.h : 0,
  };
  const members = [...((el.composition ?? []) as string[]), ...((el.children ?? []) as string[])];
  for (const key of members) {
    const child = byKey[key];
    if (child) patchElement(child, own, {x: 0, y: 0}, {x: 0, y: 0}, op, byKey, patched);
  }
};

/**
 * Поворот на 90° / отражение набора элементов.
 *
 * Рамка операции — объединённый габарит выделения. При повороте она меняет стороны
 * местами, и чтобы содержимое не уезжало в угол, результат сдвигается к прежнему центру
 * — сдвиг привязывается к сетке, иначе поворот стал бы способом слезть с неё.
 *
 * Возвращает новый массив элементов; пересчёт рамок групп-предков — на вызывающем.
 */
export const transformSelection = (
  elements: DiagramElement[],
  keys: string[],
  op: TransformOp,
  snap: (v: number) => number,
): DiagramElement[] => {
  if (!keys.length) return elements;

  const index = getElementIndex(elements);
  const byKey = index.byKey;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of keys) {
    const el = byKey[key];
    if (!el) continue;
    const b = getElementBoundsRendered(el, elements);
    if (!Number.isFinite(b.minX)) continue;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return elements;

  const frame: Size = {w: maxX - minX, h: maxY - minY};

  // Поворот меняет стороны рамки местами, и без сдвига содержимое уезжало бы в угол —
  // возвращаем его к прежнему центру. Сдвиг привязан к сетке (иначе поворот стал бы
  // способом с неё слезть), и знаки берутся ОТ ОДНОГО значения: `snap` округляет
  // половины вверх, поэтому `snap(50)` и `snap(-50)` дают 60 и −40, а не ±60 — считай
  // мы их по отдельности, четыре поворота по часовой не вернули бы фигуру на место.
  const halfDiff = swapsSides(op) ? snap(Math.abs(frame.w - frame.h) / 2) : 0;
  const sign = frame.w >= frame.h ? 1 : -1;
  const recenter = {x: halfDiff * sign, y: -halfDiff * sign};

  const patched = new Map<string, DiagramElement>();

  for (const key of keys) {
    const el = byKey[key];
    if (!el) continue;

    // Перенос «координаты родителя → координаты рамки выделения»: у элемента и рамки
    // разные начала, а внутри рамки считать удобнее (формулы выше — от её угла).
    const abs = getAbsoluteRenderedPos(el, byKey);
    const rendered = getRenderedElement(el) as unknown as Geometry;
    const localX = typeof rendered.x === "number" ? rendered.x : 0;
    const localY = typeof rendered.y === "number" ? rendered.y : 0;
    const delta = {
      x: abs.x - localX - minX,
      y: abs.y - localY - minY,
    };

    patchElement(el, frame, delta, recenter, op, byKey, patched);
  }

  if (!patched.size) return elements;
  return elements.map(el => patched.get(el.key) ?? el);
};
