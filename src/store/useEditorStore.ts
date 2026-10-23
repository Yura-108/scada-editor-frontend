import {snap, GRID} from "@/lib/utils";
import type {MonitorView} from "@/lib/editor/monitorView";
import {create} from "zustand/react";
import {GroupElement, ComponentState, DiagramElement, ElementType} from "@/types/editorElement.type";
import {temporal} from "zundo";
import {
  elementToGroupLocal,
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
  unionBounds,
  resolveParentAbsolute,
} from "@/lib/groupLayout";
import {getElementIndex} from "@/lib/editor/elementIndex";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {getAbsoluteRenderedPos} from "@/lib/editor/getAbsoluteRenderedPos";
import {
  isMetaElement, isSameSheet, readSheetFromRaw, resolveSheet, SHEET_MAX, SHEET_MIN,
} from "@/lib/editor/sheet";
import {
  detachServerBindingIds,
  detachServerEventIds,
  detachServerScriptIds,
  detachServerStateIds,
} from "@/lib/editor/detachServerIds";
import {instantiateTemplate} from "@/lib/editor/templateInstance";
import {normalizeProperty} from "@/lib/transformElements";
import {toast} from "sonner";
import {createUuid} from "@/shared/lib/createUuid";
import type {EditorProject} from "@/lib/pickProjectsFromComponents";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {
  bindEditorStore, 
  createCameraSlice, createProjectsSlice, createScenesSlice, createSelectionSlice, createVersionsSlice,
  editorSession, SCENE_EXPORT_FORMAT, sceneBelongsToCurrentProject,
  type CameraSlice, type ProjectsSlice, type SceneExportFile, type ScenesSlice,
  type SelectionSlice, type VersionsSlice, type LayoutSlice, type StatesSlice, type PropertiesSlice,
  createLayoutSlice, createStatesSlice, createPropertiesSlice,
  cloneElementsWithOffset, getDescendantKeys, isComplex, isComponentEl, isGroup, isLeafPrimitive,
  recomputeAncestorBounds, resplitContainer, 
  isPatchEffective, splitBaseOnly, syncMemberStates,
} from "@/modules/editor";
import {isConturExport, normalizeConturElements, type ConturImportStats} from "@/lib/editor/conturImport";
import {DEFAULT_CURVE_POINTS, curvePointsBounds} from "@/lib/editor/curvePoints";
import {getCanvasPointerWorld} from "@/lib/editor/canvasPointer";

export type {EditorProject};
// Общие хелперы переехали в src/modules/editor/model/editorStoreInternals.ts; эти три читают
// и снаружи стора, поэтому прежний путь импорта сохраняется.
export {canWriteCurrentProject, hasUnsavedWork, SCENE_EXPORT_FORMAT, type SceneExportFile} from "@/modules/editor";

// Стор режется на слайсы по зонам (docs/architecture.md, шаг 6); поля слайса описаны в его файле.
export type EditorState = CameraSlice & SelectionSlice & VersionsSlice & ProjectsSlice & ScenesSlice
  & LayoutSlice & StatesSlice & PropertiesSlice & {
  elements: DiagramElement[];
  clipboard: DiagramElement[] | null;
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

  /** Дубликат выделения со смещением (Ctrl+D); клоны попадают в корень сцены, как при вставке. */
  duplicateSelected: () => void;

  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  /** Мульти-версия updateElementVisual: один шаг undo для всех ключей. */
  updateElementsVisual: (keys: string[], data: Partial<DiagramElement>) => void;
  addElementAt: (x: number, y: number, type: ElementType, extraProps?: Record<string, unknown>) => void;
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  /**
   * Кладёт готовые элементы на холст ОДНИМ действием — один шаг undo на весь импорт.
   *
   * Отдельно от `importElementsFromJson`: тот назначает ключи заново, но `propertyRefs`
   * внутри биндингов не перекладывает, и у готовых копий ссылки на соседей протухли бы.
   */
  addImportedElements: (elements: DiagramElement[], mode: "append" | "replace") => void;
  deleteSelectedElement: () => void;
  copySelectedElement: () => void;
  pasteSelectedElement: () => void;
  /**
   * Импорт элементов из JSON. Выгрузка CONTUR распознаётся и переводится автоматически
   * (см. `src/lib/editor/conturImport.ts`); всё прочее импортируется как раньше.
   *
   * `mode: "replace"` кладёт на холст только импортированное — иначе повторный импорт того
   * же листа удвоит схему. Возвращает разбивку по типам для выгрузки CONTUR либо `null`.
   */
  /**
   * Сцена как переносимый JSON-файл: конверт с плоским массивом элементов в том же
   * формате, который принимает импорт (см. docs/contur/IMPORT_SCHEME_SPEC.md).
   */
  buildSceneExport: () => SceneExportFile;
  importElementsFromJson: (
    rawElements: Record<string, unknown>[],
    /** `native` — файл нашего экспорта: нормализатор чужого диалекта не запускается. */
    opts?: {mode?: "append" | "replace"; native?: boolean},
  ) => ConturImportStats | null;

  groupSelected: () => void;
  /** Асинхронный: разбитые группы удаляются и на сервере (иначе вернутся после сейва). */
  ungroupSelected: () => Promise<void>;
  createComponentFromGroup: (groupKey: string, name?: string) => void;
  disassembleComponent: (componentKey: string) => void;
  moveElementToGroup: (elementKey: string, targetGroupKey: string) => void;

  // removeElements: (ids: string[]) => void;
}

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      ...createCameraSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createVersionsSlice(set, get),
      ...createProjectsSlice(set, get),
      ...createScenesSlice(set, get),
      ...createLayoutSlice(set, get),
      ...createStatesSlice(set, get),
      ...createPropertiesSlice(set, get),

      elements: [],
      clipboard: null,
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
      addTemplate: (screenX, screenY, template) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя добавить шаблон: сцена не принадлежит выбранному проекту");
          return;
        }

        // Клонирование и позиционирование живут в `instantiateTemplate`: тем же кодом
        // пользуется импорт плана устройств, которому нужны сотни экземпляров разом.
        const newElements = instantiateTemplate(template, {
          x: screenX,
          y: screenY,
          sceneId: scene?.id ?? null,
        });

        set(state => ({
          elements: [...state.elements, ...newElements],
        }));

      },
      addImportedElements: (elements, mode) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя импортировать: сцена не принадлежит выбранному проекту");
          return;
        }

        set(state => ({
          elements: mode === "replace" ? elements : [...state.elements, ...elements],
        }));
      },
      buildSceneExport: () => {
        const {elements, scene} = get();
        const ownKeys = new Set(elements.map(el => el.key));

        const exported = elements.map(el => {
          // Серверные id снимаем те же, что и при копировании (см. detachServer*Ids):
          // файл может уехать в другую сцену или другой проект, и чужой id там означает
          // «эта сущность переехала» — оригинал потеряет своё, а слияние выдаст конфликт.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const {id: _id, parentId: _parentId, ...rest} = el as unknown as Record<string, unknown>;

          return {
            ...rest,
            id: null,
            parentId: null,
            // Корни помечаем так, как описано в нашей же спецификации импорта: ключа
            // сцены в файле нет, и «undefined» честнее, чем id чужой сцены.
            parentKey: el.parentKey && ownKeys.has(el.parentKey) ? el.parentKey : "undefined",
            states: detachServerStateIds(el.states),
            scripts: detachServerScriptIds(el.scripts),
            bindings: detachServerBindingIds(el.bindings),
            ...(el.events ? {events: detachServerEventIds(el.events)} : {}),
          };
        });

        // Конверт, а не голый массив: по нему импорт узнаёт СВОЙ файл и не запускает
        // нормализатор CONTUR повторно. Схема, однажды пришедшая из выгрузки, хранит её
        // поля (`lua_name`, `tech_object`) — детектор диалекта сработал бы на них снова
        // и второй раз вычел радиус из координат каждого кружка.
        return {
          format: SCENE_EXPORT_FORMAT,
          version: 1,
          exported_at: new Date().toISOString(),
          scene: {name: scene?.name ?? null},
          elements: exported,
        };
      },
      importElementsFromJson: (rawElements, importOpts) => {
        const {scene, currentProject} = get();

        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя импортировать: сцена не принадлежит выбранному проекту");
          return null;
        }

        // Выгрузка CONTUR приходит в своих именах полей и своей системе координат —
        // переводим ДО общей нормализации, чтобы дальше всё шло одним путём.
        // `native` — файл нашего же экспорта: поля уже в наших именах и координатах.
        const contur = !importOpts?.native && isConturExport(rawElements)
          ? normalizeConturElements(rawElements)
          : null;
        if (contur) rawElements = contur.elements;

        // База процентных координат — размер ЛИСТА, на котором чертёж нарисован:
        // процент осмыслен только относительно него, а не относительно константы.
        // Лист берём из служебного элемента файла (`meta.canvas`).
        //
        // Фолбэк намеренно 5000, а не размер листа по умолчанию: проценты шлёт
        // только прошлое поколение выгрузок CONTUR, а у него служебного элемента
        // нет вовсе. Подставить туда лист — молча растянуть все такие файлы.
        const rawSheet = readSheetFromRaw(rawElements as Record<string, unknown>[]);
        const CANVAS_W = rawSheet?.w ?? 5000;
        const CANVAS_H = rawSheet?.h ?? 5000;

        const isNullish = (v: unknown) =>
          v == null || v === "null" || v === "undefined";

        const parseBool = (v: unknown, fallback: boolean): boolean => {
          if (v === true  || v === "true")  return true;
          if (v === false || v === "false") return false;
          return fallback;
        };

        // Converts a value to a pixel coordinate.
        // If the value is a percentage string like "84.9%", multiplies by `total` (canvas width or height).
        // If the value is already a number, returns it as-is.
        const parseCoord = (v: unknown, total: number): number => {
          if (typeof v === "number") return v;
          if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed.endsWith("%")) {
              return (parseFloat(trimmed) / 100) * total;
            }
            const n = parseFloat(trimmed);
            return isNaN(n) ? 0 : n;
          }
          return 0;
        };

        // Pass 1: assign new keys to every element, build old→new key map
        const keyMap: Record<string, string> = {};
        for (const raw of rawElements) {
          const oldKey = String(raw.key ?? "");
          const newKey = createUuid();
          if (oldKey && !isNullish(oldKey)) {
            keyMap[oldKey] = newKey;
          }
          (raw as Record<string, unknown>).__newKey = newKey;
        }

        // Pass 2: normalise each element
        const imported: DiagramElement[] = rawElements.map(raw => {
          const newKey = raw.__newKey as string;

          const oldParentKey = String(raw.parentKey ?? "");
          const isTopLevel = isNullish(raw.parentKey) || !keyMap[oldParentKey];
          const parentKey = isTopLevel
            ? String(scene?.id)
            : keyMap[oldParentKey];

          const children = Array.isArray(raw.children)
            ? (raw.children as string[]).map(ck => keyMap[ck] ?? ck)
            : [];

          const composition = Array.isArray(raw.composition)
            ? (raw.composition as string[]).map(ck => keyMap[ck] ?? ck)
            : [];

          const states = Array.isArray(raw.states)
            ? (raw.states as Record<string, unknown>[]).map(s => ({
                id: isNullish(s.id) ? createUuid() : String(s.id),
                name: String(s.name ?? "Нормальное"),
                overrides: (s.overrides as Record<string, unknown>) ?? {},
                isDefault: parseBool(s.isDefault, false),
              }))
            : [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }];

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { __newKey, ...rest } = raw as Record<string, unknown>;

          return {
            ...rest,
            id:          isNullish(raw.id) ? null : Number(raw.id),
            key:         newKey,
            parentKey,
            // parentId из чужой сцены/проекта невалиден:
            //   - верхнеуровневые элементы должны ссылаться на id текущей сцены;
            //   - дети импортируемых групп ещё не сохранены на сервере → parentId = null
            //     (группы сами сохранят своих детей на бэкенде, и id появятся при следующей загрузке).
            parentId:    isTopLevel ? (scene?.id ?? null) : null,
            composition,
            isComponent: parseBool(raw.isComponent, false),
            children,
            scripts:     Array.isArray(raw.scripts)    ? raw.scripts    : [],
            bindings:    Array.isArray(raw.bindings)   ? raw.bindings   : [],
            // Старые выгрузки несут description вместо gateway_name — см. normalizeProperty.
            properties:  Array.isArray(raw.properties) ? raw.properties.map(normalizeProperty) : [],
            states,
            // Convert percentage strings to pixel coordinates using the logical canvas size
            x:  parseCoord(raw.x,  CANVAS_W),
            y:  parseCoord(raw.y,  CANVAS_H),
            w:  parseCoord(raw.w,  CANVAS_W),
            h:  parseCoord(raw.h,  CANVAS_H),
            ...(raw.x1 !== undefined && { x1: parseCoord(raw.x1, CANVAS_W) }),
            ...(raw.y1 !== undefined && { y1: parseCoord(raw.y1, CANVAS_H) }),
            ...(raw.x2 !== undefined && { x2: parseCoord(raw.x2, CANVAS_W) }),
            ...(raw.y2 !== undefined && { y2: parseCoord(raw.y2, CANVAS_H) }),
          } as DiagramElement;
        });

        set(state => ({
          elements: importOpts?.mode === "replace" ? imported : [...state.elements, ...imported],
        }));

        return contur?.stats ?? null;
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
      copySelectedElement: () => {
        const { selectedIds, elements } = get();
        if (!selectedIds.length) return;

        // Собираем все выделенные элементы и всех их потомков (для групп)
        const allKeys = new Set<string>();
        for (const key of selectedIds) {
          allKeys.add(key);
          getDescendantKeys(key, elements).forEach(k => allKeys.add(k));
        }

        set({ clipboard: elements.filter(el => allKeys.has(el.key)) });
        // Новый буфер — счётчики вставок с нуля (см. pasteSelectedElement).
        editorSession.pasteCount = 0;
        editorSession.lastPastePoint = null;
        editorSession.stackedPastes = 0;
        toast.success('Скопировано');
      },
      pasteSelectedElement: () => {
        const { clipboard, scene, currentProject } = get();
        if (!clipboard || !clipboard.length) return;

        // Тот же guard, что у addElementAt/addTemplate/importElementsFromJson: без
        // сцены корни получали parentKey "" и становились сиротами — они нигде не
        // рендерятся и молча отбрасываются buildComponentTree при сохранении.
        if (!sceneBelongsToCurrentProject(scene, currentProject)) {
          toast.error("Нельзя вставить: сцена не принадлежит выбранному проекту");
          return;
        }

        // Вставляем туда, где курсор: центр вставляемого набора встаёт под мышь.
        // Так вставка перестаёт быть лотереей «куда упадёт» — место выбирает человек.
        const pointer = getCanvasPointerWorld();
        let offset: {dx: number; dy: number};

        if (pointer) {
          const target = {x: snap(pointer.x), y: snap(pointer.y)};

          // Повторная вставка в ту же точку — лесенкой, иначе копии сложатся невидимо.
          if (editorSession.lastPastePoint && editorSession.lastPastePoint.x === target.x && editorSession.lastPastePoint.y === target.y) {
            editorSession.stackedPastes += 1;
          } else {
            editorSession.stackedPastes = 0;
          }
          editorSession.lastPastePoint = target;

          // Габарит считаем по самому буферу: у корней в нём свои координаты, а
          // getElementBoundsRendered умеет и линию (концы), и кривую с полигоном (точки).
          const roots = clipboard.filter(el => !clipboard.some(other => other.key === el.parentKey));
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const root of roots) {
            const b = getElementBoundsRendered(root, clipboard);
            if (!Number.isFinite(b.minX)) continue;
            minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
            maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
          }

          const step = editorSession.stackedPastes * GRID;
          offset = Number.isFinite(minX)
            ? {
                dx: snap(target.x - (minX + maxX) / 2) + step,
                dy: snap(target.y - (minY + maxY) / 2) + step,
              }
            : {dx: step, dy: step};
        } else {
          // Курсор над холстом ещё не появлялся — прежнее поведение: каскад от оригинала.
          editorSession.pasteCount += 1;
          offset = {dx: 60 * editorSession.pasteCount, dy: 60 * editorSession.pasteCount};
        }

        const {newElements, newRootKeys} = cloneElementsWithOffset(clipboard, scene, offset);

        set(state => ({
          elements: [...state.elements, ...newElements],
          selectedIds: newRootKeys,
        }));
      },
      duplicateSelected: () => {
        const { selectedIds, elements, scene } = get();
        if (!selectedIds.length) return;

        // Выделенные + все их потомки (как в copySelectedElement), но без буфера обмена.
        const allKeys = new Set<string>();
        for (const key of selectedIds) {
          allKeys.add(key);
          getDescendantKeys(key, elements).forEach(k => allKeys.add(k));
        }

        const {newElements, newRootKeys} = cloneElementsWithOffset(
          elements.filter(el => allKeys.has(el.key)),
          scene,
        );

        set(state => ({
          elements: [...state.elements, ...newElements],
          selectedIds: newRootKeys,
        }));
      },
      groupSelected: () => {
        const {elements, selectedIds, scene} = get();
        if (selectedIds.length < 2) return;

        const topLevelSelected = elements
          .filter(el => selectedIds.includes(el.key))
          .filter(el => {
            let parentKey: string | null | undefined = el.parentKey;

            while (parentKey) {
              if (selectedIds.includes(parentKey)) return false;
              parentKey = elements.find(e => e.key === parentKey)?.parentKey;
            }

            return true;
          }) as DiagramElement[];

        if (topLevelSelected.length < 2) return;

        const simple = topLevelSelected.filter(el => !isGroup(el) && !isComplex(el));
        const complex = topLevelSelected.filter(isComplex);
        const groups = topLevelSelected.filter(isGroup);

        if (simple.length > 0 && complex.length === 0 && groups.length === 1) {
          const targetGroup = groups[0] as GroupElement;
          const simpleKeys = simple.map(s => s.key);
          // ВАЖНО: включаем composition (запечённые примитивы компонента) в состав —
          // иначе рамка считается без них, а их локальные координаты не компенсируются
          // при сдвиге origin группы.
          const allMemberKeys = [
            ...new Set([
              ...(targetGroup.children ?? []),
              ...(targetGroup.composition ?? []),
              ...simpleKeys,
            ]),
          ];

          const boundsByKey = snapshotBounds(elements, allMemberKeys);

          let updatedElements = layoutGroupFromBounds(
            elements,
            targetGroup.key,
            allMemberKeys,
            boundsByKey,
            GROUP_PADDING,
            scene?.id,
          );

          // layoutGroupFromBounds кладёт ВСЕХ членов в children. Для компонента
          // переразбиваем состав по роли: примитивы → composition, компоненты → children,
          // иначе примитивы сериализуются как вложенные компоненты (порча данных).
          if (isComponentEl(targetGroup)) {
            updatedElements = resplitContainer(updatedElements, targetGroup.key, allMemberKeys);
          }

          // Новые члены получают весь набор состояний контейнера — иначе панель
          // «Состояния» показывает у них одно состояние против четырёх у компонента.
          updatedElements = syncMemberStates(updatedElements, targetGroup.key, allMemberKeys);

          set({
            elements: updatedElements,
            selectedIds: [targetGroup.key],
          });

          return;
        }

        const newGroupId = createUuid();
        const selectedKeys = topLevelSelected.map(el => el.key);
        const parentKeys = [...new Set(topLevelSelected.map(el => el.parentKey).filter(Boolean))];
        // Без сцены фолбэк — null (а не литерал "undefined" от String(undefined)).
        const commonParentKey = parentKeys.length === 1 ? parentKeys[0] : (scene ? String(scene.id) : null);
        const commonParentElement = commonParentKey
          ? elements.find(el => el.key === commonParentKey && el.type === "group") as GroupElement | undefined
          : undefined;
        const newGroupParentId = commonParentKey === String(scene?.id)
          ? scene?.id || null
          : commonParentElement?.id ?? null;

        const boundsByKey = snapshotBounds(elements, selectedKeys);
        const box = unionBounds([...boundsByKey.values()], GROUP_PADDING);
        const parentAbs = resolveParentAbsolute(commonParentKey, elements, scene?.id);

        let updatedElements = elements.map(el => {
          if (!selectedKeys.includes(el.key)) return el;

          const bounds = boundsByKey.get(el.key)!;
          return {
            ...elementToGroupLocal(el, bounds, box.absX, box.absY),
            parentKey: newGroupId,
            parentId: null,
          };
        });

        if (commonParentElement) {
          updatedElements = updatedElements.map(el => {
            if (el.key !== commonParentElement.key) return el;

            const nextChildren = el.children.filter(childKey => !selectedKeys.includes(childKey));
            const insertIndex = el.children.findIndex(childKey => selectedKeys.includes(childKey));

            if (insertIndex >= 0) {
              nextChildren.splice(insertIndex, 0, newGroupId);
            } else {
              nextChildren.push(newGroupId);
            }

            return {...el, children: nextChildren};
          });
        }

        const group: GroupElement = {
          id: null,
          key: newGroupId,
          type: "group",
          x: box.absX - parentAbs.x,
          y: box.absY - parentAbs.y,
          w: box.w,
          h: box.h,
          composition: [],
          children: selectedKeys,
          parentId: newGroupParentId,
          parentKey: commonParentKey,
          label: `Group (${topLevelSelected.length})`,
          bg: "rgba(59,130,246,0.08)",
          borderStyle: "dashed",
          borderColor: "#3b82f6",
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

        set({
          elements: [...updatedElements, group],
          selectedIds: [newGroupId],
        });
      },
      ungroupSelected: async () => {
        const { elements, selectedIds, activeGroupKey, scene } = get();

        // 1. Находим среди выделенных элементов только группы
        const groupsToUngroup = elements.filter(
          (el) => selectedIds.includes(el.key) && el.type === "group"
        );

        // Если не выделено ни одной группы, ничего не делаем
        if (groupsToUngroup.length === 0) return;

        const groupIdsToRemove = groupsToUngroup.map((g) => g.key);

        // Здесь мы соберем ID элементов, которые освободятся из-под групп,
        // чтобы автоматически сделать их выделенными после разгруппировки
        const newlySelectedIds: string[] = [];

        // Работаем с копией массива элементов
        let updatedElements = [...elements];

        // Проходимся по каждой группе, которую нужно разбить
        groupsToUngroup.forEach((group) => {
          const {
            key: groupId,
            x: groupX,
            y: groupY,
            parentKey: grandParentKey,
          } = group;

          // Члены группы — и children (компоненты/узлы), и composition (примитивы компонента).
          const memberKeys = [...(group.children ?? []), ...(group.composition ?? [])];
          newlySelectedIds.push(...memberKeys);

          // parentId «дедушки»: корень сцены → id сцены, группа → её серверный id
          // (null, если она ещё не сохранена — бэкенд свяжет по parent_key).
          const grandParentId =
            grandParentKey === String(scene?.id)
              ? scene?.id ?? null
              : (updatedElements.find((el) => el.key === grandParentKey)?.id ?? null);

          // Шаг А: Обновляем ВСЕХ членов разбиваемой группы (по parentKey — покрывает
          // и children, и composition). Прибавляем координаты исчезающей группы, причём
          // сдвигаем и базовые поля, и позиционные ключи в overrides состояний:
          // у перемещённого внутри группы листа актуальная позиция живёт в overrides,
          // и сдвиг только базового x/y «телепортирует» его на старое место.
          // parentId переписываем вместе с parentKey: иначе в нём остаётся серверный id
          // удалённой группы, и сохранение падает с 400 «Component not found».
          updatedElements = updatedElements.map((el) => {
            if (el.parentKey === groupId) {
              return {
                ...shiftElementPositions(el, groupX, groupY),
                // Член переходит под крыло "дедушки" (если группа сама была внутри группы)
                parentKey: grandParentKey,
                parentId: grandParentId,
              };
            }
            return el;
          });

          // Шаг Б: Если удаляемая группа лежала ВНУТРИ другой группы ("дедушки") —
          // вливаем членов в прародителя с учётом роли (примитивы → composition,
          // компоненты → children), иначе примитивы-члены осиротеют.
          if (grandParentKey) {
            const grandParent = updatedElements.find(
              (el) => el.key === grandParentKey && el.type === "group",
            );
            if (grandParent) {
              const mergedMemberKeys = [
                ...grandParent.children.filter((key) => key !== groupId),
                ...(grandParent.composition ?? []).filter((key) => key !== groupId),
                ...memberKeys,
              ];
              if (isComponentEl(grandParent)) {
                updatedElements = resplitContainer(updatedElements, grandParentKey, mergedMemberKeys);
                updatedElements = syncMemberStates(updatedElements, grandParentKey, memberKeys);
              } else {
                // «Глупая» группа держит всё в children.
                updatedElements = updatedElements.map((el) =>
                  el.key === grandParentKey
                    ? {...el, children: mergedMemberKeys, composition: []}
                    : el,
                );
              }
            }
          }
        });

        // 2. Окончательно удаляем сами разбитые группы из массива
        updatedElements = updatedElements.filter((el) => !groupIdsToRemove.includes(el.key));

        // 3. Сохраняем в выделении обычные фигуры, которые были выделены вместе с группами
        const retainedSelectedIds = selectedIds.filter((id) => !groupIdsToRemove.includes(id));

        // Разбитые группы исчезают на сервере сами: состав сцены уезжает целиком в
        // `PUT`, и группы, которой в теле нет, после сохранения не будет. Раньше здесь
        // требовался явный `DELETE` — старый `POST` был upsert-ом и возвращал группу
        // обратно после следующего сохранения.
        set({
          elements: updatedElements,
          selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
          // Если разбили группу, внутри которой находились — выходим из неё.
          ...(activeGroupKey && groupIdsToRemove.includes(activeGroupKey) ? {activeGroupKey: null} : {}),
        });
      },
      createComponentFromGroup: (groupKey, name) => {
        set(state => {
          const elements = state.elements;
          const group = elements.find(el => el.key === groupKey);
          if (!group || group.type !== "group") return {};

          const primitiveKeys: string[] = [];
          const componentKeys: string[] = [];
          const dissolvedGroupKeys = new Set<string>();
          // key -> накопленный сдвиг для перевода в координатное пространство компонента
          const offsetByKey = new Map<string, {dx: number; dy: number}>();
          const reparent = new Set<string>();

          // Обходим поддерево: примитивы (в т.ч. из вложенных «глупых» групп) → composition,
          // компоненты → children; обычные под-группы расформировываем, накапливая их смещение.
          const walk = (containerKey: string, dx: number, dy: number) => {
            for (const kid of elements.filter(e => e.parentKey === containerKey)) {
              if (isLeafPrimitive(kid)) {
                primitiveKeys.push(kid.key);
                offsetByKey.set(kid.key, {dx, dy});
                reparent.add(kid.key);
              } else if (isComponentEl(kid)) {
                componentKeys.push(kid.key);
                offsetByKey.set(kid.key, {dx, dy});
                reparent.add(kid.key);
              } else {
                // обычная под-группа: узел исчезает, дети поднимаются в компонент
                dissolvedGroupKeys.add(kid.key);
                walk(kid.key, dx + kid.x, dy + kid.y);
              }
            }
          };
          walk(groupKey, 0, 0);

          const shift = (el: DiagramElement): DiagramElement => {
            const off = offsetByKey.get(el.key) ?? {dx: 0, dy: 0};
            const leaf = el as import("@/types/editorElement.type").LeafElement;
            return {
              ...el,
              parentKey: groupKey,
              parentId: group.id,
              x: el.x + off.dx,
              y: el.y + off.dy,
              ...(leaf.x1 !== undefined ? {x1: leaf.x1 + off.dx} : {}),
              ...(leaf.y1 !== undefined ? {y1: leaf.y1 + off.dy} : {}),
              ...(leaf.x2 !== undefined ? {x2: leaf.x2 + off.dx} : {}),
              ...(leaf.y2 !== undefined ? {y2: leaf.y2 + off.dy} : {}),
            } as DiagramElement;
          };

          const updated = elements
            .filter(el => !dissolvedGroupKeys.has(el.key))
            .map(el => {
              if (el.key === groupKey) {
                return {
                  ...el,
                  isComponent: true,
                  composition: primitiveKeys,
                  children: componentKeys,
                  label: name ?? el.label ?? "Компонент",
                } as DiagramElement;
              }
              if (reparent.has(el.key)) return shift(el);
              return el;
            });

          // Примитивы, ставшие составом компонента, получают его состояния.
          return {
            elements: syncMemberStates(updated, groupKey, [...primitiveKeys, ...componentKeys]),
            selectedIds: [groupKey],
          };
        });
      },
      disassembleComponent: (componentKey) => {
        set(state => {
          const group = state.elements.find(el => el.key === componentKey);
          if (!group || group.type !== "group") return {};

          const composition = group.composition ?? [];
          return {
            elements: state.elements.map(el =>
              el.key === componentKey
                ? ({
                    ...el,
                    isComponent: false,
                    children: [...el.children, ...composition],
                    composition: [],
                  } as DiagramElement)
                : el,
            ),
          };
        });
      },
      moveElementToGroup: (elementKey, targetGroupKey) => {
        const { elements, scene } = get();
        const element = elements.find(el => el.key === elementKey);
        const targetGroup = elements.find(el => el.key === targetGroupKey);

        if (!element || !targetGroup || targetGroup.type !== "group") return;

        const oldParentKey = element.parentKey;

        // Полный состав целевого контейнера + перемещаемый — для расчёта рамки.
        const targetMemberKeys = [
          ...new Set([
            ...(targetGroup.children ?? []),
            ...(targetGroup.composition ?? []),
            elementKey,
          ]),
        ];
        const targetBoundsByKey = snapshotBounds(elements, targetMemberKeys);

        // Убираем перемещаемый из ОБОИХ списков старого родителя.
        let updatedElements = elements.map(el => {
          if (el.key === oldParentKey && el.type === "group" && oldParentKey !== targetGroupKey) {
            return {
              ...el,
              children: el.children.filter(k => k !== elementKey),
              composition: (el.composition ?? []).filter(k => k !== elementKey),
            } as DiagramElement;
          }
          return el;
        });

        updatedElements = layoutGroupFromBounds(
          updatedElements,
          targetGroupKey,
          targetMemberKeys,
          targetBoundsByKey,
          GROUP_PADDING,
          scene?.id,
        );

        // layoutGroupFromBounds сложил все ключи в children — переразбиваем по роли.
        updatedElements = resplitContainer(updatedElements, targetGroupKey, targetMemberKeys);
        updatedElements = syncMemberStates(updatedElements, targetGroupKey, targetMemberKeys);

        if (oldParentKey && oldParentKey !== targetGroupKey) {
          const oldGroup = updatedElements.find(
            el => el.key === oldParentKey && el.type === "group",
          ) as GroupElement | undefined;

          const oldMembers = oldGroup
            ? [...oldGroup.children, ...(oldGroup.composition ?? [])]
            : [];

          if (oldMembers.length) {
            const oldBoundsByKey = snapshotBounds(updatedElements, oldMembers);
            updatedElements = layoutGroupFromBounds(
              updatedElements,
              oldParentKey,
              oldMembers,
              oldBoundsByKey,
              GROUP_PADDING,
              scene?.id,
            );
            updatedElements = resplitContainer(updatedElements, oldParentKey, oldMembers);
            updatedElements = syncMemberStates(updatedElements, oldParentKey, oldMembers);
          }
        }

        set({ elements: updatedElements });
      }
    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
      }),
      // Пишем в историю ТОЛЬКО когда реально изменился массив elements.
      // Иначе zundo фиксирует снапшот на каждый set() (камера/зум/пан, выделение и т.п.)
      // и стек заполняется «пустыми» дублями — Ctrl+Z приходится жать много раз.
      // Все мутации элементов создают новый массив, поэтому сравнения по ссылке достаточно.
      equality: (a, b) => a.elements === b.elements,
    }
  )
);

// Общие хелперы (editorStoreInternals) берут стор отсюда — импортировать его сами не могут.
bindEditorStore(useEditorStore);

/**
 * Подчищает выделение, когда выделенных элементов больше нет в `elements`.
 *
 * История undo хранит только `elements` (см. partialize), поэтому отмена вставки
 * или дублирования возвращает массив элементов, а `selectedIds` остаются ключами
 * уже несуществующих копий: панель свойств пустела, а кнопки группировки в
 * ToolsPanel оставались активными (они смотрят на `selectedIds.length`).
 *
 * Сам `set` историю не пишет: `equality` сравнивает ссылку на `elements`, а она
 * здесь не меняется.
 */
useEditorStore.subscribe((state, prev) => {
  if (state.elements === prev.elements) return;

  // Флаг «есть несохранённые изменения» — здесь же, чтобы не заводить второй
  // подписчик на тот же самый сигнал.
  const dirty = state.elements !== editorSession.savedElementsSnapshot;
  if (dirty !== state.isDirty) useEditorStore.setState({isDirty: dirty});

  if (state.selectedIds.length === 0 && state.activeGroupKey === null) return;

  const keys = new Set(state.elements.map(el => el.key));
  const nextSelected = state.selectedIds.filter(k => keys.has(k));
  const activeGone = state.activeGroupKey !== null && !keys.has(state.activeGroupKey);

  if (nextSelected.length === state.selectedIds.length && !activeGone) return;

  useEditorStore.setState({
    selectedIds: nextSelected,
    ...(activeGone ? {activeGroupKey: null} : {}),
  });
});
