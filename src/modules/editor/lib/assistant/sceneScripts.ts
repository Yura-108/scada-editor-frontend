import type {DiagramElement} from "@/core/scene";

/** Где живёт скрипт элемента — от этого зависит, какое поле правится. */
export type SceneScriptPlace = "script" | "event" | "binding" | "onChange";

/** Скрипт открытой сцены для массовой правки помощником. */
export interface SceneScript {
  /** Ключ для `scripts/edit`: сервер возвращает его как есть, по нему находим скрипт. */
  id: string;
  elementKey: string;
  elementLabel: string;
  place: SceneScriptPlace;
  /** Имя внутри элемента: имя скрипта, событие, имя привязки или свойства. */
  name: string;
  code: string;
}

const PLACE_LABEL: Record<SceneScriptPlace, string> = {
  script: "скрипт",
  event: "событие",
  binding: "привязка",
  onChange: "onChange свойства",
};

export const scriptPlaceLabel = (place: SceneScriptPlace) => PLACE_LABEL[place];

const SEP = "::";
const scriptId = (elementKey: string, place: SceneScriptPlace, name: string) =>
  [elementKey, place, name].join(SEP);

/**
 * Все непустые скрипты сцены: серверные, обработчики событий, привязки и `onChange` свойств.
 * Ключ строится из ключа элемента, места и локального имени — по нему же правка находит,
 * куда записать новый код.
 */
export function collectSceneScripts(elements: DiagramElement[]): SceneScript[] {
  const out: SceneScript[] = [];
  for (const el of elements) {
    const elementLabel = el.label?.trim() || el.type;
    const push = (place: SceneScriptPlace, localId: string, name: string, code: string | undefined) => {
      if (!code?.trim()) return;
      out.push({id: scriptId(el.key, place, localId), elementKey: el.key, elementLabel, place, name, code});
    };
    for (const s of el.scripts ?? []) push("script", s.id, s.name, s.content);
    for (const e of el.events ?? []) push("event", e.event_type, e.event_type, e.handler?.code);
    for (const b of el.bindings ?? []) push("binding", b.id, b.name, b.code);
    for (const p of el.properties ?? []) push("onChange", p.name, p.name, p.onChange);
  }
  return out;
}

/** Текущий код скрипта по ключу или `undefined`, если скрипта больше нет. */
export function findScriptCode(elements: DiagramElement[], id: string): string | undefined {
  return collectSceneScripts(elements).find(s => s.id === id)?.code;
}

/** Элемент с новым кодом одного скрипта; ключ — из `collectSceneScripts`. */
function withScriptCode(el: DiagramElement, place: SceneScriptPlace, localId: string, code: string): DiagramElement {
  switch (place) {
    case "script":
      return {...el, scripts: el.scripts.map(s => (s.id === localId ? {...s, content: code} : s))} as DiagramElement;
    case "event":
      return {
        ...el,
        events: (el.events ?? []).map(e => (e.event_type === localId ? {...e, handler: {...e.handler, code}} : e)),
      } as DiagramElement;
    case "binding":
      return {...el, bindings: el.bindings.map(b => (b.id === localId ? {...b, code} : b))} as DiagramElement;
    case "onChange":
      return {...el, properties: el.properties.map(p => (p.name === localId ? {...p, onChange: code} : p))} as DiagramElement;
  }
}

export interface ScriptCodeEdit {
  id: string;
  oldCode: string;
  newCode: string;
}

/**
 * Применяет правки к массиву элементов. Правка, чей скрипт успел измениться после запроса
 * (текущий код не равен `oldCode`) или исчез, пропускается: перезаписать её значило бы
 * молча потерять чужую или свою более позднюю правку.
 */
export function applyScriptCodes(elements: DiagramElement[], edits: ScriptCodeEdit[]) {
  const current = new Map(collectSceneScripts(elements).map(s => [s.id, s.code]));
  const applied: string[] = [];
  const stale: string[] = [];
  let next = elements;

  for (const edit of edits) {
    if (current.get(edit.id) !== edit.oldCode) {
      stale.push(edit.id);
      continue;
    }
    const [elementKey, place, ...rest] = edit.id.split(SEP);
    const localId = rest.join(SEP);
    next = next.map(el => (el.key === elementKey
      ? withScriptCode(el, place as SceneScriptPlace, localId, edit.newCode)
      : el));
    applied.push(edit.id);
  }
  return {elements: next, applied, stale};
}
