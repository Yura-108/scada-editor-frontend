import {getSceneView, type DiagramElement, type ElementEventName} from "@/core/scene";
import {showRuntimeMenu, type ActionArgs, type EventRunResult, type SandboxValues, type ScreenPoint, type TagScope} from "@/core/runtime";
import {devLog} from "@/shared/lib/devLog";
import type {EngineBuffers} from "./engineBuffers";
import {openSceneFromScript} from "./openSceneFromScript";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/**
 * Значения скоупа обработчика на момент клика — только его теги и свойства, а не весь буфер
 * движка: песочница видит ровно то, что видел бы скрипт на странице.
 */
export const scopeValues = (scope: TagScope, buffers: EngineBuffers): SandboxValues => {
  const tags: [string, string | null][] = [];
  for (const tagId of Object.values(scope.tagIdByName)) {
    const v = buffers.values.get(tagId);
    if (v !== undefined) tags.push([tagId, v]);
  }
  const props: [number, string][] = [];
  for (const propertyId of Object.values(scope.propertyIdByName)) {
    const v = buffers.valuesByProp.get(propertyId);
    if (v !== undefined) props.push([propertyId, v]);
  }
  return {tags, props};
};

interface ApplyParams {
  el: DiagramElement;
  event: ElementEventName;
  point?: ScreenPoint;
  result: Exclude<EventRunResult, {error: string}>;
  buffers: EngineBuffers;
  runScript: (name: string, args?: ActionArgs) => void;
  flush: () => void;
}

/**
 * Результат обработчика из песочницы — в том же порядке, в каком он применялся, когда скрипт
 * выполнялся на странице: сначала `runScript` (раньше уходили прямо во время исполнения), затем
 * записи свойств и вид элемента, `flush`, и последним — переход или меню выбора.
 */
export function applyEventResult({el, event, point, result, buffers, runScript, flush}: ApplyParams) {
  // ACTION отправляет страница — с проверкой прав и точкой отказа (runScriptOn).
  for (const call of result.runScript) runScript(call.name, call.args);

  // Записи свойств → тот же буфер, что и WS properties[]: на них реагируют
  // биндинги других элементов. НЕ трогаем valuesByProp здесь: flush сравнивает
  // pending со «старым» valuesByProp, чтобы понять, что значение изменилось —
  // предварительная запись сделала бы изменение «no-op», и биндинги бы не сработали.
  // flush (вызывается ниже) сам обновит valuesByProp для следующего клика.
  for (const w of result.writes) {
    buffers.pendingProps.set(w.propertyId, w.value);
  }

  // Интенты setProp/setState — на сам элемент, применяем немедленно.
  if (result.intents.length) {
    const stateNameByKey: Record<string, string> = {};
    const propsByKey: Record<string, Record<string, unknown>> = {};
    for (const intent of result.intents) {
      if (intent.kind === "state") stateNameByKey[el.key] = intent.stateName;
      else (propsByKey[el.key] ??= {})[intent.key] = intent.value;
    }
    getSceneView().applyRuntimeBatch({stateNameByKey, propsByKey});
  }

  log(`событие ${event} по «${el.label ?? el.key}»: записей ${result.writes.length}, интентов ${result.intents.length}, runScript ${result.runScript.length}`);
  if (result.writes.length) flush();

  // Переход — последним: записи setProperty уже ушли во flush выше, а смена схемы
  // заменит elements, и применять интенты было бы уже не к чему.
  if (result.openScene !== undefined) {
    void openSceneFromScript(result.openScene, el.label ?? el.key);
    // Меню выбора поверх схемы, которая сейчас сменится, было бы не к месту.
    if (result.menu) console.warn(`[monitor:event] ${event} «${el.label ?? el.key}»: openScene и showMenu сразу — меню не показано`);
    return;
  }
  // Меню выбора рисует холст: пункт подтверждается и уходит через emitRuntimeScript.
  // Без точки клика (не из слоя интеракции) показывать его негде.
  if (result.menu && point) showRuntimeMenu({elementKey: el.key, point, items: result.menu});
}
