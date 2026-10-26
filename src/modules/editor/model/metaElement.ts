import {DiagramElement} from "@/types/editorElement.type";
import {createUuid} from "@/shared/lib/createUuid";

/**
 * Новый служебный элемент «Лист» (`type: "meta"`, на холсте не рисуется): в нём лежат
 * данные сцены — размер листа (`canvas`) и зафиксированный вид монитора (`monitorView`).
 * Заводится, когда такого элемента у сцены ещё нет (лист по умолчанию).
 *
 * `fields` — то, ради чего элемент заводят: `{canvas}` или `{monitorView}`.
 */
export function newMetaElement(sceneId: number | undefined, fields: Record<string, unknown>): DiagramElement {
  return {
    id: null,
    key: createUuid(),
    type: "meta",
    visible: false,
    ...fields,
    x: 0, y: 0, w: 0, h: 0,
    composition: [],
    parentId: sceneId ?? null,
    parentKey: String(sceneId ?? ""),
    children: [],
    label: "Лист",
    scripts: [], bindings: [], properties: [],
    states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
  } as unknown as DiagramElement;
}
