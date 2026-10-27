import {DiagramElement} from "@/types/editorElement.type";
import {createUuid} from "@/shared/lib/createUuid";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {readSheetFromRaw} from "@/lib/editor/sheet";
import {normalizeProperty} from "@/lib/transformElements";
import {isConturExport, normalizeConturElements, type ConturImportStats} from "@/lib/editor/conturImport";

/**
 * Элементы из файла импорта — в элементы схемы `sceneId`: новые ключи с пересчётом ссылок
 * родитель ↔ ребёнок, состояния и свойства в нашем виде, проценты — в координаты листа.
 * Выгрузку CONTUR (`native` = false) сначала переводит в наши поля.
 *
 * Возвращает элементы и разбивку CONTUR по типам (`null` — файл не CONTUR).
 */
export function normalizeImportedElements(
  rawElements: Record<string, unknown>[],
  sceneId: number | undefined,
  native: boolean | undefined,
): {elements: DiagramElement[]; stats: ConturImportStats | null} {
  // Выгрузка CONTUR приходит в своих именах полей и своей системе координат —
  // переводим ДО общей нормализации, чтобы дальше всё шло одним путём.
  // `native` — файл нашего же экспорта: поля уже в наших именах и координатах.
  const contur = !native && isConturExport(rawElements)
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
      ? String(sceneId)
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
      parentId:    isTopLevel ? (sceneId ?? null) : null,
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

  return {elements: imported, stats: contur?.stats ?? null};
}
