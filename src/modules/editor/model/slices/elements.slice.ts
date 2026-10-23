import {snap, GRID} from "@/lib/utils";
import type {MonitorView} from "@/lib/editor/monitorView";
import {ComponentState, DiagramElement, ElementType} from "@/types/editorElement.type";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {getAbsoluteRenderedPos} from "@/lib/editor/getAbsoluteRenderedPos";
import {
  isMetaElement, isSameSheet, resolveSheet, SHEET_MAX, SHEET_MIN,
} from "@/lib/editor/sheet";
import {toast} from "sonner";
import {createUuid} from "@/shared/lib/createUuid";
import {DEFAULT_CURVE_POINTS, curvePointsBounds} from "@/lib/editor/curvePoints";
import type {EditorState} from "@/store/useEditorStore";
import {
  sceneBelongsToCurrentProject,
} from "../editorStoreInternals";
import {
  getDescendantKeys, isComponentEl, isGroup, isLeafPrimitive,
  recomputeAncestorBounds,
} from "../elementTree";
import {
  isPatchEffective, splitBaseOnly,
  syncMemberStates,
} from "../elementStates";

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

    const composition: string[] = [];

    const x = snap(screenX);
    const y = snap(screenY);

    /**
     * Кладёт готовый элемент в схему — в открытый контейнер, если пользователь в него
     * вошёл, иначе в корень сцены.
     *
     * Раньше все ветки писали `parentKey: scene.id` намертво, и добавить примитив в
     * компонент было нельзя вообще: приходилось класть его рядом и потом «Переместить
     * в группу». Элемент строится в МИРОВЫХ координатах, поэтому внутрь контейнера он
     * переезжает сдвигом на его абсолютную позицию (`shiftElementPositions` двигает и
     * `x/y`, и концы линии, и overrides всех состояний).
     */
    const commitNewElement = (element: DiagramElement) => {
      const {activeGroupKey, elements} = get();
      const {byKey} = getElementIndex(elements);
      const host = activeGroupKey ? byKey[activeGroupKey] : undefined;

      if (!host || !isGroup(host)) {
        set(state => ({elements: [...state.elements, element]}));
        return;
      }

      const hostAbs = getAbsoluteRenderedPos(host, byKey);
      const local = shiftElementPositions(element, -hostAbs.x, -hostAbs.y);
      const member: DiagramElement = {
        ...local,
        parentKey: host.key,
        parentId: host.id ?? null,
      };

      // Роль в контейнере — та же, что у resplitContainer: примитивы компонента
      // живут в composition, компоненты — в children.
      const toComposition = isLeafPrimitive(member) && isComponentEl(host);

      set(state => {
        let next = [
          ...state.elements.map(el => el.key !== host.key ? el : ({
            ...el,
            children: toComposition ? el.children : [...el.children, member.key],
            composition: toComposition
              ? [...(el.composition ?? []), member.key]
              : (el.composition ?? []),
          } as DiagramElement)),
          member,
        ];
        // Новый член сразу получает весь набор состояний контейнера.
        next = syncMemberStates(next, host.key, [member.key]);
        // Рамка контейнера обязана вырасти под новый элемент.
        return {elements: recomputeAncestorBounds(next, [member.key], scene?.id)};
      });
    };

    if (type === 'line') {
      const newElement: DiagramElement = {
        id: null,
        key: createUuid(),
        type,
        composition,
        x,
        y,
        x1: x - 40,
        x2: x + 40,
        y1: y,
        y2: y,
        w: 80,
        h: 80,
        parentId: scene?.id || null,
        parentKey: String(scene?.id) || null,
        children: [],
        label: "Element",
        bg: "transparent",
        scripts: [],
        bindings: [],
        properties: [],
        states: [{
          id: createUuid(),
          name: "Нормальное",
          overrides: {},
          isDefault: true,
        }],
      };

      commitNewElement(newElement);

      return;
    }

    if (type === 'curve') {
      // Кубическая кривая Безье: точки локальны относительно x/y (как у полигона),
      // поэтому перетаскивание меняет только x/y, а форма живёт в points.
      const points = [...DEFAULT_CURVE_POINTS];
      const bounds = curvePointsBounds(points);
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY,
        points,
        label: "",
        bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
        arrowStart: false, arrowEnd: false,
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'arc') {
      // Радиус 60 = три клетки; габарит — описанный квадрат 2r×2r, как у круга
      // (см. ArcShapeElement). Раствор 90°, начало 0° — четверть окружности
      // от «трёх часов» по часовой стрелке.
      const radius = 60;
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 2 * radius, h: 2 * radius,
        radius, innerRadius: 0, angle: 90, rotate: 0, arcClosed: false,
        label: "",
        bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'checkbox') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 160, h: 20,
        checked: false, label: "Checkbox",
        color: "#3b82f6", strokeColor: "#3b82f6",
        bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'progress_bar') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 200, h: 20,
        value: 50, label: "", orientation: "horizontal",
        color: "#3b82f6", backgroundColor: "#e5e7eb",
        textColor: "#ffffff", showPercentage: true,
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'button') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 120, h: 40,
        // label — название элемента, text — надпись на кнопке: поля независимы.
        label: "Кнопка", text: "Кнопка", color: "#3b82f6", textColor: "#ffffff", fontSize: 16,
        rx: 6, pressed: false, enabled: true, bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'toggle') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 40, h: 20,
        checked: false, label: "",
        color: "#22c55e", backgroundColor: "#9ca3af", textColor: "#e5e7eb", bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'slider') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 160, h: 20,
        value: 50, min: 0, max: 100,
        color: "#3b82f6", backgroundColor: "#d1d5db", bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'dropdown') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 160, h: 40,
        value: "Выбор",
        backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'input') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 160, h: 40,
        value: "", placeholder: "Введите...",
        backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'image') {
      // Дроп создаёт элемент СРАЗУ (плейсхолдер), src заполняется обработчиком
      // после выбора файла в проводнике — по этому же key (extraProps.key).
      const key = typeof extraProps?.key === 'string' ? extraProps.key : createUuid();
      const src = typeof extraProps?.src === 'string' ? extraProps.src : "";
      const w = typeof extraProps?.w === 'number' ? extraProps.w : 120;
      const h = typeof extraProps?.h === 'number' ? extraProps.h : 120;
      const newElement: DiagramElement = {
        id: null, key, type, composition,
        x, y, w, h,
        src, objectFit: "contain", bg: "transparent",
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        label: "Картинка",
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    if (type === 'table') {
      const newElement: DiagramElement = {
        id: null, key: createUuid(), type, composition,
        x, y, w: 300, h: 160,
        rows: 4, cols: 3, showHeader: true, headerText: "Таблица", alternateRow: false,
        backgroundColor: "transparent", headerColor: "transparent",
        strokeColor: "#000000", textColor: "#000000", fontSize: 12,
        alternateColor: "#f1f5f9",
        cells: {},
        parentId: scene?.id || null, parentKey: String(scene?.id) || null,
        children: [], scripts: [], bindings: [], properties: [],
        states: [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
      };
      commitNewElement(newElement);
      return;
    }

    const newElement: DiagramElement = {
      id: null,
      key: createUuid(),
      type,
      composition,
      x,
      y,
      w: 80,
      h: 80,
      // У круга рендер и панель свойств читают radius, а не w/h. Без него фигура
      // рисовалась по w/2, но в панели «Радиус» стоял 0, а первая же правка радиуса
      // прыгала с 40 на введённое. Держим тройку radius/w/h согласованной с рождения.
      ...(type === "circle" ? {radius: 40} : {}),
      parentId: scene?.id || null,
      parentKey: String(scene?.id) || null,
      children: [],
      label: "Element",
      bg: "transparent",
        scripts: [],
        bindings: [],
      properties: [],
      states: [{
        id: createUuid(),
        name: "Нормальное",
        overrides: {},
        isDefault: true,
      }],
    };

    commitNewElement(newElement);
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
