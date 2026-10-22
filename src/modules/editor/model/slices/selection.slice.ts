import type {DiagramElement, SceneType} from "@/types/editorElement.type";

/**
 * Зона «Выделение» стора редактора: что выбрано и на каком уровне вложенности стоит
 * пользователь. **Слайс не меняет `elements`** — всё здесь транзиентно, вне undo и сохранения.
 * Операции НАД выделением, которые правят схему (сдвиг, выравнивание, слои, удаление,
 * дубликат, копирование/вставка), остаются в документе: они попадают в undo.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6): другие зоны сбрасывают
 * выделение своим `set()` (загрузка сцены, удаление, вставка), здесь — только свои экшены.
 */
export interface SelectionSlice {
  selectedIds: string[];
  select: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  /** Выделить все элементы текущего скоупа (активная группа или корень сцены), Ctrl+A. */
  selectAllInScope: () => void;

  activeGroupKey: string | null;
  enterGroup: (key: string) => void;
  exitGroup: () => void;
  /**
   * Показать элемент: открыть его уровень и выделить. Для панели «Слои» — там можно
   * ткнуть во вложенный элемент, не входя в группу, а на холсте он был бы недоступен.
   */
  revealElement: (key: string) => void;

  /**
   * Ячейка таблицы, сфокусированная в панели свойств (для показа cell-специфичных
   * полей). Транзиентно, как selectedIds/activeGroupKey — не в elements, вне undo.
   */
  selectedTableCell: {elementKey: string; row: number; col: number} | null;
  selectTableCell: (elementKey: string, row: number, col: number) => void;
  clearTableCellSelection: () => void;

  /**
   * Ключ текстового элемента, редактируемого сейчас инлайн (или null).
   *
   * Живёт в сторе, а не в локальном состоянии Canvas, чтобы узел холста мог
   * подписаться точечно («редактируют именно меня») — иначе двойной клик по
   * тексту перерисовывал бы всю сцену.
   */
  editingTextKey: string | null;
  setEditingTextKey: (key: string | null) => void;

  /**
   * Режим «Править все состояния»: правка визуала выделенного элемента пишется в
   * overrides ВСЕХ его состояний, а не только текущего. Нужен для оформления, которое
   * одинаково во всех состояниях компонента (подпись, рамка): иначе его пришлось бы
   * повторять в каждом состоянии руками. Транзиентный, как selectedTableCell — не в
   * elements, значит вне undo (сами правки в undo попадают как обычно).
   */
  editAllStates: boolean;
  setEditAllStates: (value: boolean) => void;
}

/** Что слайсу нужно от остального стора: элементы (родители, скоуп) и сцена (корень). */
type SelectionDeps = SelectionSlice & {elements: DiagramElement[]; scene: SceneType | null};

type SelectionSet = (
  partial: Partial<SelectionSlice> | ((state: SelectionDeps) => Partial<SelectionSlice>),
) => void;

export const createSelectionSlice = (set: SelectionSet, get: () => SelectionDeps): SelectionSlice => ({
  selectedIds: [],
  activeGroupKey: null,
  selectedTableCell: null,
  editAllStates: false,
  editingTextKey: null,

  selectAllInScope: () => {
    const {elements, scene, activeGroupKey} = get();
    const scopeKey = activeGroupKey ?? String(scene?.id ?? "");
    const keys = elements.filter(el => String(el.parentKey) === scopeKey).map(el => el.key);
    if (keys.length) set({selectedIds: keys, selectedTableCell: null});
  },

  select: (id) => set({selectedIds: id ? [id] : [], selectedTableCell: null}),
  // Повторное выделение того же набора не должно менять ссылку на массив:
  // на неё подписан каждый узел холста, и новый массив с тем же составом
  // означал бы лишний ре-рендер (например, при обычном клике по уже
  // выделенной фигуре — сначала нажатие, потом сам click).
  selectMultiple: (ids) => set(state => {
    const same = state.selectedIds.length === ids.length
      && state.selectedIds.every((k, i) => k === ids[i]);
    if (same && state.selectedTableCell === null) return {};
    return {selectedIds: same ? state.selectedIds : [...ids], selectedTableCell: null};
  }),
  clearSelection: () => set({selectedIds: [], selectedTableCell: null}),
  // editingTextKey сбрасываем вместе с уровнем: начатая внутри группы правка текста
  // иначе переживала бы выход из неё, и оверлей висел бы над недоступной фигурой.
  enterGroup: (key) => set({
    activeGroupKey: key, selectedIds: [], selectedTableCell: null, editingTextKey: null,
  }),
  revealElement: (key) => set(state => {
    const el = state.elements.find(e => e.key === key);
    if (!el) return {};
    // Родитель — группа? Тогда открываем её. Элемент корня сцены поднимает нас в корень.
    const parent = state.elements.find(e => e.key === el.parentKey);
    return {
      activeGroupKey: parent && parent.type === "group" ? parent.key : null,
      selectedIds: [key],
      selectedTableCell: null,
      editingTextKey: null,
    };
  }),
  setEditAllStates: (value) => set({editAllStates: value}),

  selectTableCell: (elementKey, row, col) => set({selectedTableCell: {elementKey, row, col}}),
  setEditingTextKey: (key) => set({editingTextKey: key}),
  clearTableCellSelection: () => set({selectedTableCell: null}),
  exitGroup: () => set(state => {
    if (!state.activeGroupKey) return {};
    const group = state.elements.find(el => el.key === state.activeGroupKey);
    const parentKey = group?.parentKey;
    const parentIsGroup = parentKey
      ? state.elements.find(el => el.key === parentKey)?.type === 'group'
      : false;
    return {
      activeGroupKey: parentIsGroup ? parentKey! : null,
      selectedIds: [],
      selectedTableCell: null,
      editingTextKey: null,
    };
  }),
});
