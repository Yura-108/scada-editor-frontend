import {snap, GRID} from "@/lib/utils";
import type {MonitorView} from "@/lib/editor/monitorView";
import {ComponentState, DiagramElement, ElementType} from "@/types/editorElement.type";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {
  isMetaElement, isSameSheet, resolveSheet, SHEET_MAX, SHEET_MIN,
} from "@/lib/editor/sheet";
import {toast} from "sonner";
import {createUuid} from "@/shared/lib/createUuid";
import type {EditorState} from "../editorStore";
import {
  sceneBelongsToCurrentProject,
} from "../editorStoreInternals";
import {
  getDescendantKeys, isGroup,
  recomputeAncestorBounds,
} from "../elementTree";
import {
  isPatchEffective, splitBaseOnly,
} from "../elementStates";
import {buildNewElement} from "../newElement";
import {placeNewElement} from "../placeNewElement";

/**
 * Зона «Элементы» документа стора редактора: сам массив `elements`, правка элемента и его
 * визуала (с пересчётом рамок групп), постановка нового элемента, удаление выделенного,
 * лист сцены и зафиксированный вид монитора. Правила — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6): всё, что меняет
 * `elements`, идёт в undo и в сохранение. Код перенесён без изменений.
 */
export interface ElementsSlice {
  elements: DiagramElement[];
  /** Размер листа сцены. Читается из elements (`resolveSheet`), тут только запись. */
  setSheet: (w: number, h: number) => void;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  /**
   * Зафиксировать вид сцены для монитора (замок в панели зума редактора) или снять его
   * (`null`). Это данные сцены, а не состояние просмотра: вид пишется в служебный элемент
   * рядом с размером листа, попадает в undo, помечает сцену несохранённой и уезжает на
   * сервер с сохранением. См. lib/editor/monitorView.ts.
   */
  setMonitorView: (view: MonitorView | null) => void;

  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  /** Мульти-версия updateElementVisual: один шаг undo для всех ключей. */
  updateElementsVisual: (keys: string[], data: Partial<DiagramElement>) => void;
  addElementAt: (x: number, y: number, type: ElementType, extraProps?: Record<string, unknown>) => void;
  deleteSelectedElement: () => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createElementsSlice = (set: EditorSet, get: () => EditorState): ElementsSlice => ({
  elements: [],
  connecting: null,

  setMonitorView: (view) => {
    const {scene, currentProject, versionPreview} = get();
    // Просмотр версии — только для чтения; сцена чужого проекта — не наша.
    if (versionPreview || !sceneBelongsToCurrentProject(scene, currentProject)) return;

    set(state => {
      const meta = state.elements.find(isMetaElement);
      if (meta) {
        const {monitorView: _old, ...rest} = meta as unknown as Record<string, unknown>;
        void _old;
        const next = view ? {...rest, monitorView: view} : rest;
        return {
          elements: state.elements.map(el => el.key === meta.key ? next as unknown as DiagramElement : el),
        };
      }
      if (!view) return {};

      // Служебного элемента ещё нет (лист по умолчанию) — заводим его тем же видом, что
      // и setSheet, но без блока `canvas`: лист остаётся по умолчанию.
      const created = {
        id: null,
        key: createUuid(),
        type: "meta",
        visible: false,
        monitorView: view,
        x: 0, y: 0, w: 0, h: 0,
        composition: [],
        parentId: scene?.id ?? null,
        parentKey: String(scene?.id ?? ""),
        children: [],
        label: "Лист",
        scripts: [], bindings: [], properties: [],
        states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
      } as unknown as DiagramElement;
      return {elements: [...state.elements, created]};
    });
  },

  /**
   * Размер листа сцены.
   *
   * Пишем в блок `canvas` служебного элемента, а не в поля сцены: эндпоинта
   * обновления сцены не существует (у неё только GET, POST-создание и DELETE),
   * а служебный элемент сохраняется вместе со всеми остальными и переживает
   * round-trip. Приём не наш — так уже устроен `contur_meta` у CONTUR.
   */
  setSheet: (w, h) => {
    const {scene, currentProject} = get();
    if (!sceneBelongsToCurrentProject(scene, currentProject)) return;

    const clamp = (v: number) => Math.min(SHEET_MAX, Math.max(SHEET_MIN, snap(v)));
    const next = {w: clamp(w), h: clamp(h)};
    if (isSameSheet(resolveSheet(get().elements), next)) return;

    set(state => {
      const meta = state.elements.find(isMetaElement);

      if (meta) {
        return {
          elements: state.elements.map(el => el.key === meta.key
            ? {
              ...el,
              canvas: {
                // Остальные поля блока (units/grid/scale/origin) — данные CONTUR,
                // сохраняем как есть.
                ...((el as unknown as Record<string, unknown>).canvas as object ?? {}),
                width: next.w,
                height: next.h,
              },
            } as unknown as DiagramElement
            : el),
        };
      }

      const created = {
        id: null,
        key: createUuid(),
        type: "meta",
        visible: false,
        canvas: {width: next.w, height: next.h, units: "px", grid: GRID},
        x: 0, y: 0, w: 0, h: 0,
        composition: [],
        parentId: scene?.id ?? null,
        parentKey: String(scene?.id ?? ""),
        children: [],
        label: "Лист",
        scripts: [], bindings: [], properties: [],
        states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
      } as unknown as DiagramElement;

      return {elements: [...state.elements, created]};
    });
  },
  updateElementVisual: (key, updates) => get().updateElementsVisual([key], updates),
  // Мульти-версия: один set() (= один шаг undo) для всех ключей.
  updateElementsVisual: (keys, updates) => {
     if (!keys.length) return;
     const { currentComponentStateByElementKey, editAllStates } = get();
     const keySet = new Set(keys);

     set(state => {
       // Хотя бы один элемент реально изменился. Без этого флага холостая
       // запись (перетаскивание, вернувшееся в ту же точку; повторный выбор
       // того же цвета) создавала новый массив elements — а значит шаг undo,
       // пометку «есть несохранённые изменения» и ре-рендер всей сцены.
       let anyChanged = false;

       const updatedElements = state.elements.map(el => {
         if (!keySet.has(el.key)) return el;

         // Валидация: гарантируем минимальные размеры для групп и элементов
         const MIN_SIZE = 20;
         const validatedUpdates = {
           ...updates,
           ...(updates.w !== undefined && { w: Math.max(MIN_SIZE, updates.w) }),
           ...(updates.h !== undefined && { h: Math.max(MIN_SIZE, updates.h) }),
         };

         // Группы всегда хранят позицию в base, не в overrides.
         // recomputeAncestorBounds читает group.x (base), поэтому override
         // приводит к расхождению rendered.x vs base.x и телепортации детей.
         if (isGroup(el)) {
           if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
           anyChanged = true;
           return { ...el, ...validatedUpdates } as DiagramElement;
         }

         const currentComponentStateId = currentComponentStateByElementKey[el.key]
           ?? el.states.find(s => s.isDefault)?.id
           ?? el.states[0]?.id;

         if (!currentComponentStateId) {
           if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
           anyChanged = true;
           return {
             ...el,
             ...validatedUpdates,
           } as DiagramElement;
         }

         // Сравниваем с ФАКТИЧЕСКИМ значением (база + overrides состояния), а не
         // только с overrides: у нетронутого элемента позиция лежит в базе, и
         // сравнение с пустыми overrides считало бы любую запись изменением.
         //
         // В режиме «править все состояния» проверять одно текущее нельзя: патч,
         // совпавший с ним, но отличный от остальных, обязан примениться — иначе
         // выравнивание состояний молча не срабатывало бы.
         const effectiveOf = (st: ComponentState | undefined) => ({
           ...(el as unknown as Record<string, unknown>),
           ...(st?.overrides ?? {}),
         });
         const patchLands = editAllStates
           ? el.states.some(st => isPatchEffective(effectiveOf(st), validatedUpdates))
           : isPatchEffective(effectiveOf(el.states.find(s => s.id === currentComponentStateId)), validatedUpdates);
         if (!patchLands) return el;
         anyChanged = true;

         // Часть ключей (BASE_ONLY_KEYS, например слой zIndex) пишем в базу даже
         // у листа: они не зависят от состояния. Если состояний-специфичных
         // ключей в патче нет — states не пересобираем.
         const {base: baseUpdates, state: stateUpdates} = splitBaseOnly(validatedUpdates);

         return {
           ...el,
           ...baseUpdates,
           // editAllStates — правка ложится во ВСЕ состояния элемента: оформление,
           // одинаковое во всех состояниях, иначе пришлось бы повторять руками в каждом.
           states: Object.keys(stateUpdates).length
             ? el.states.map(s =>
               (editAllStates || s.id === currentComponentStateId)
                 ? {
                   ...s,
                   overrides: {
                     ...s.overrides,
                     ...stateUpdates,
                   },
                 }
                 : s
             )
             : el.states,
         } as DiagramElement;
       });

       if (!anyChanged) return {};

       // Если изменились поля, влияющие на габарит — пересчитываем рамки групп-предков.
       //
       // Кроме собственно позиционных сюда входят: параметры текста (его габарит меряет
       // `measureText`, а не `w/h` — укоротил подпись, и рамка осталась под старую длину),
       // `rotate` (меняется осевой bbox) и `visible` (скрытый элемент из рамки выпадает,
       // см. isBoundsContributor).
       const POSITIONAL_KEYS = new Set([
         "x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points",
         "text", "fontSize", "fontFamily", "bold", "autoWidth", "rotate", "visible",
       ]);
       const hasPositionalChange = Object.keys(updates).some(k => POSITIONAL_KEYS.has(k));
       if (hasPositionalChange) {
         return { elements: recomputeAncestorBounds(updatedElements, keys, state.scene?.id) };
       }

       return { elements: updatedElements };
     });
   },
  updateElement: (key, updates) => {
    set(state => ({
      elements: state.elements.map(el =>
        el.key === key
          ? { ...el, ...updates } as DiagramElement
          : el
      )
    }));
  },
  addElementAt: (screenX, screenY, type, extraProps) => {
    const {scene, currentProject} = get();
    const rect = get().canvasRect;
    if (!rect) return;

    if (!sceneBelongsToCurrentProject(scene, currentProject)) {
      toast.error("Нельзя добавить элемент: сцена не принадлежит выбранному проекту");
      return;
    }

    const x = snap(screenX);
    const y = snap(screenY);

    // Элемент строится в мировых координатах в корне сцены; в открытый контейнер его
    // переносит placeNewElement.
    const element = buildNewElement(type, x, y, scene?.id, extraProps);
    const {activeGroupKey, elements} = get();
    set({elements: placeNewElement(elements, element, activeGroupKey, scene?.id)});
  },
  deleteSelectedElement: async () => {
    const { selectedIds, elements, activeGroupKey, scene } = get();
    if (!selectedIds.length) return;

    // Каскад: удаляем выделенные + всех их потомков (children и composition, любой глубины).
    const descendantKeys = selectedIds.flatMap(key => getDescendantKeys(key, elements));

    const idsToDelete = new Set([...selectedIds, ...descendantKeys]);

    // Уцелевшие родители удаляемых: чистим их children/composition от висячих ключей
    // и пересчитываем рамки (иначе рамка остаётся растянутой под удалённое).
    const parentKeysToClean = new Set(
      elements
        .filter(el => idsToDelete.has(el.key) && el.parentKey && !idsToDelete.has(el.parentKey))
        .map(el => el.parentKey!)
    );

    let nextElements = elements
      .filter(el => !idsToDelete.has(el.key))
      .map(el =>
        parentKeysToClean.has(el.key)
          ? {
              ...el,
              children: el.children.filter(k => !idsToDelete.has(k)),
              composition: (el.composition ?? []).filter(k => !idsToDelete.has(k)),
            } as DiagramElement
          : el
      );

    // Уцелевшим родителям пересчитываем рамку одним проходом: точкой входа
    // берём любого их оставшегося члена (цепочка предков от него включает
    // самого родителя).
    const membersToRecompute: string[] = [];
    const survivorsIndex = getElementIndex(nextElements);
    for (const parentKey of parentKeysToClean) {
      const parent = survivorsIndex.byKey[parentKey];
      if (!parent || parent.type !== "group") continue;
      const firstMember = [...(parent.children ?? []), ...(parent.composition ?? [])][0];
      if (firstMember) membersToRecompute.push(firstMember);
    }
    if (membersToRecompute.length) {
      nextElements = recomputeAncestorBounds(nextElements, membersToRecompute, scene?.id);
    }

    // Удаление живёт только локально и уезжает ближайшим сохранением: тело `PUT`
    // описывает состав сцены целиком, и компонента, которого в нём нет, сервер
    // удаляет сам. Отдельный `DELETE` тут был нужен старому upsert-`POST`, который
    // возвращал удалённое обратно; с новым контрактом это второй версионируемый
    // путь записи со своим 409 — и лишний.
    set({
      elements: nextElements,
      selectedIds: [],
      selectedTableCell: null,
      currentComponentStateByElementKey: Object.fromEntries(
        Object.entries(get().currentComponentStateByElementKey).filter(
          ([elementKey]) => !idsToDelete.has(elementKey)
        )
      ),
      // Если удалили группу, внутри которой находились — выходим из неё.
      ...(activeGroupKey && idsToDelete.has(activeGroupKey) ? {activeGroupKey: null} : {}),
    });
  },
});
