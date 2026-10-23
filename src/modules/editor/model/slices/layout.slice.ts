import {snap} from "@/lib/utils";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {zIndexOf} from "@/lib/editor/zOrder";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {transformSelection, type TransformOp} from "@/lib/editor/transformSelection";
import type {EditorState} from "../editorStore";
import {topLevelSelectedKeys, applyShifts, recomputeAncestorBounds} from "../elementTree";

/**
 * Зона «Раскладка выделения» документа стора редактора. Сдвиг, поворот и отражение, выравнивание и
 * распределение, порядок слоёв.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6); правит `elements`,
 * поэтому всё здесь идёт в undo и в сохранение. Код перенесён без изменений.
 */
export interface LayoutSlice {
  /** Сдвиг всех верхнеуровневых выделенных на dx/dy (стрелки, мульти-drag). excludeKey — уже сдвинут сам. */
  moveSelectedBy: (dx: number, dy: number, excludeKey?: string) => void;
  bringToFront: (key: string) => void;
  sendToBack: (key: string) => void;
  /** Выравнивание верхнеуровневых выделенных (≥2) по краю/центру общей рамки. */
  /**
   * Поворот на 90° и отражение выделения (в т.ч. групп) — пересчётом геометрии.
   * Подробности и причина, почему не полем `rotate`, — в transformSelection.ts.
   */
  transformSelected: (op: TransformOp) => void;
  alignSelected: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  /** Распределение верхнеуровневых выделенных (≥3) с равными зазорами по оси. */
  distributeSelected: (axis: 'h' | 'v') => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createLayoutSlice = (set: EditorSet, get: () => EditorState): LayoutSlice => ({
  moveSelectedBy: (dx, dy, excludeKey) => {
    if (!dx && !dy) return;
    const {selectedIds, elements, scene} = get();
    if (!selectedIds.length) return;

    const keysToMove = topLevelSelectedKeys(selectedIds, elements).filter(k => k !== excludeKey);
    if (!keysToMove.length) return;

    const shifts = new Map(keysToMove.map(k => [k, {dx, dy}] as const));
    set({elements: applyShifts(elements, shifts, scene?.id)});
  },
  transformSelected: (op) => {
    const {selectedIds, elements, scene} = get();
    if (!selectedIds.length) return;

    // Только верхнеуровневые: у элемента с выделенным предком геометрию пересчитает
    // сам предок, иначе поворот применился бы к нему дважды.
    const keys = topLevelSelectedKeys(selectedIds, elements);
    if (!keys.length) return;

    const next = transformSelection(elements, keys, op, snap);
    if (next === elements) return;

    // Одним set() — значит одним шагом undo на всю операцию.
    set({elements: recomputeAncestorBounds(next, keys, scene?.id)});
  },
  alignSelected: (mode) => {
    const {selectedIds, elements, scene} = get();
    const keys = topLevelSelectedKeys(selectedIds, elements);
    if (keys.length < 2) return;

    const {byKey} = getElementIndex(elements);
    const boundsByKey = new Map(keys.map(k => [k, getElementBoundsRendered(byKey[k], elements)] as const));
    const bs = [...boundsByKey.values()].filter(b => isFinite(b.minX));
    if (bs.length < 2) return;

    // Цель — край/центр общей рамки выделения.
    const isH = mode === 'left' || mode === 'hcenter' || mode === 'right';
    const min = Math.min(...bs.map(b => isH ? b.minX : b.minY));
    const max = Math.max(...bs.map(b => isH ? b.maxX : b.maxY));
    const target = mode === 'left' || mode === 'top' ? min
      : mode === 'right' || mode === 'bottom' ? max
      : (min + max) / 2;

    const shifts = new Map<string, {dx: number; dy: number}>();
    for (const k of keys) {
      const b = boundsByKey.get(k)!;
      if (!isFinite(b.minX)) continue;
      const cur = mode === 'left' ? b.minX
        : mode === 'right' ? b.maxX
        : mode === 'hcenter' ? (b.minX + b.maxX) / 2
        : mode === 'top' ? b.minY
        : mode === 'bottom' ? b.maxY
        : (b.minY + b.maxY) / 2;
      const d = target - cur;
      if (d) shifts.set(k, isH ? {dx: d, dy: 0} : {dx: 0, dy: d});
    }
    if (!shifts.size) return;
    set({elements: applyShifts(elements, shifts, scene?.id)});
  },
  distributeSelected: (axis) => {
    const {selectedIds, elements, scene} = get();
    const keys = topLevelSelectedKeys(selectedIds, elements);
    if (keys.length < 3) return;

    const {byKey} = getElementIndex(elements);
    const items = keys
      .map(k => ({key: k, b: getElementBoundsRendered(byKey[k], elements)}))
      .filter(it => isFinite(it.b.minX))
      .sort((a, b) => axis === 'h' ? a.b.minX - b.b.minX : a.b.minY - b.b.minY);
    if (items.length < 3) return;

    // Равные зазоры: крайние остаются на месте, промежуточные раскладываются между ними.
    const size = (b: (typeof items)[0]['b']) => axis === 'h' ? b.maxX - b.minX : b.maxY - b.minY;
    const start = axis === 'h' ? items[0].b.minX : items[0].b.minY;
    const end = axis === 'h' ? items[items.length - 1].b.maxX : items[items.length - 1].b.maxY;
    const sumSizes = items.reduce((acc, it) => acc + size(it.b), 0);
    const gap = (end - start - sumSizes) / (items.length - 1);

    const shifts = new Map<string, {dx: number; dy: number}>();
    let pos = start;
    for (const it of items) {
      const cur = axis === 'h' ? it.b.minX : it.b.minY;
      const d = pos - cur;
      if (d) shifts.set(it.key, axis === 'h' ? {dx: d, dy: 0} : {dx: 0, dy: d});
      pos += size(it.b) + gap;
    }
    if (!shifts.size) return;
    set({elements: applyShifts(elements, shifts, scene?.id)});
  },
  // Порядок отрисовки задаёт `zIndex` (в пределах контейнера — среди соседей
  // с общим parentKey), поэтому «на передний/задний план» — это просто выход
  // за текущий диапазон слоёв соседей. Перекладывать массивы больше не нужно:
  // порядок массива остался лишь тай-брейком при равных слоях.
  bringToFront: (key) => {
    const {elements} = get();
    const el = elements.find(e => e.key === key);
    if (!el) return;
    const top = elements.reduce(
      (acc, e) => (e.key !== key && String(e.parentKey) === String(el.parentKey)
        ? Math.max(acc, zIndexOf(e))
        : acc),
      0,
    );
    get().updateElementVisual(key, {zIndex: top + 1});
  },
  sendToBack: (key) => {
    const {elements} = get();
    const el = elements.find(e => e.key === key);
    if (!el) return;
    const bottom = elements.reduce(
      (acc, e) => (e.key !== key && String(e.parentKey) === String(el.parentKey)
        ? Math.min(acc, zIndexOf(e))
        : acc),
      0,
    );
    get().updateElementVisual(key, {zIndex: bottom - 1});
  },
});
