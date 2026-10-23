import {snap, GRID} from "@/lib/utils";
import {DiagramElement} from "@/types/editorElement.type";
import {
  readSheetFromRaw,
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
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {isConturExport, normalizeConturElements, type ConturImportStats} from "@/lib/editor/conturImport";
import {getCanvasPointerWorld} from "@/lib/editor/canvasPointer";
import type {EditorState} from "../editorStore";
import {editorSession} from "../editorSession";
import {
  SCENE_EXPORT_FORMAT, sceneBelongsToCurrentProject, type SceneExportFile,
} from "../editorStoreInternals";
import {
  cloneElementsWithOffset, getDescendantKeys,
} from "../elementTree";

/**
 * Зона «Буфер, импорт и шаблоны» документа стора редактора: копирование, вставка (лесенкой
 * под курсор — счётчики в `editorSession`), дубликат, постановка шаблона палитры, импорт и
 * экспорт схемы в JSON. Копии снимают серверные id — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Код перенесён без
 * изменений.
 */
export interface ClipboardSlice {
  clipboard: DiagramElement[] | null;
  /** Дубликат выделения со смещением (Ctrl+D); клоны попадают в корень сцены, как при вставке. */
  duplicateSelected: () => void;
  addTemplate: (screenX: number, screenY: number, template: DiagramElement[]) => void;
  /**
   * Кладёт готовые элементы на холст ОДНИМ действием — один шаг undo на весь импорт.
   *
   * Отдельно от `importElementsFromJson`: тот назначает ключи заново, но `propertyRefs`
   * внутри биндингов не перекладывает, и у готовых копий ссылки на соседей протухли бы.
   */
  addImportedElements: (elements: DiagramElement[], mode: "append" | "replace") => void;
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
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createClipboardSlice = (set: EditorSet, get: () => EditorState): ClipboardSlice => ({
  clipboard: null,

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
});
