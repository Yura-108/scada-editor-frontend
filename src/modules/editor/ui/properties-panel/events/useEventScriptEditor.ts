import {useMemo, useState} from "react";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {
  describeSandboxFailure, describeSceneTarget, editorTestSandbox, modernizeScopeCode, resolveSceneTarget, toSandboxValues,
  type EventRunResult,
} from "@/core/runtime";
import {getRenderedElement} from "@/core/scene";
import type {DiagramElement} from "@/core/scene";
import type {ElementEventHandler, ElementEventName, ElementEvents} from "@/core/scene";
import {useEditorStore} from "../../../model/editorStore";
import {useScriptDraft} from "../script/useScriptDraft";
import type {ScriptTestOutcome} from "../script/ScriptTestRun";

type TestResult =
  | {kind: "ok"; text: string}
  | {kind: "error"; message: string}
  | null;

/** Чип свойства и выбор свойства вставляют запись в него. */
const setPropertyCall = (varName: string) => `setProperty("${varName}", ${varName} + 1)`;

/** Состояние окна скрипта события: код, ссылки на свойства, схемы для openScene, тест-прогон, сохранение. */
export function useEventScriptEditor(element: DiagramElement, event: ElementEventName) {
  const closeModal = useCloseModal();
  const existing = element.events?.find(e => e.event_type === event)?.handler;

  // Старый синтаксис «Имя.V» показываем уже переведённым — см. useBindingEditor.
  const draft = useScriptDraft({
    properties: element.properties,
    initialRefs: existing?.propertyRefs,
    initialCode: names => modernizeScopeCode(existing?.code ?? "", names),
    insertForRef: setPropertyCall,
  });
  const {code, propertyRefs, scope, syntaxError} = draft;

  const [testResult, setTestResult] = useState<TestResult>(null);
  // Схемы текущего проекта — для чипов openScene и для тест-прогона. Текущую не
  // предлагаем: переход на саму себя монитор просто пропустит.
  const sceneList = useEditorStore(s => s.sceneList);
  const currentSceneId = useEditorStore(s => s.scene?.id ?? null);
  const otherScenes = useMemo(
    () => sceneList.filter(s => s.id !== currentSceneId),
    [sceneList, currentSceneId],
  );

  // Прогон — в песочнице (см. useBindingEditor). runScript в тест-прогоне ничего не отправляет:
  // песочница и так возвращает вызовы списком, здесь их только показываем.
  const runTest = async () => {
    const handler: ElementEventHandler = {code, propertyRefs};
    const {valuesByTagId, valuesByPropertyId} = draft.mockMaps();
    let res: EventRunResult;
    try {
      res = await editorTestSandbox().testEvent(
        {id: `${element.key}:${event}`, elementKey: element.key, handler, scope},
        toSandboxValues(valuesByTagId, valuesByPropertyId),
        getRenderedElement(element),
      );
    } catch (err) {
      setTestResult({kind: "error", message: describeSandboxFailure(err)});
      return;
    }
    if ("error" in res) {
      const stage = res.stage === "compile" ? "компиляции" : "исполнения";
      setTestResult({kind: "error", message: `Ошибка ${stage}: ${res.error}`});
      return;
    }
    const scriptCalls = res.runScript.map(c =>
      `runScript(${JSON.stringify(c.name)}${c.args ? `, ${JSON.stringify(c.args)}` : ""})`);
    const parts = [
      ...res.writes.map(w => `setProperty(#${w.propertyId}) ← ${JSON.stringify(w.value)}`),
      ...res.intents.map(i =>
        i.kind === "state" ? `setState("${i.stateName}")` : `setProp("${i.key}", ${JSON.stringify(i.value)})`,
      ),
      ...scriptCalls,
    ];
    if (res.menu) {
      parts.push(`showMenu → пунктов: ${res.menu.length}`);
      for (const item of res.menu) {
        const known = element.scripts?.some(sc => sc.name === item.script);
        parts.push(`  «${item.label}» → ${item.script}${item.args ? ` ${JSON.stringify(item.args)}` : ""}${known ? "" : " (нет такого скрипта)"}`);
      }
    }
    if (res.openScene !== undefined) {
      // Тот же разбор, что в мониторе, — иначе тест обещал бы переход, которого не будет.
      const target = resolveSceneTarget(res.openScene, sceneList);
      parts.push(
        target.kind === "found"
          ? `openScene → «${target.scene.name}» (#${target.scene.id})`
          : target.kind === "ambiguous"
            ? `openScene → несколько схем ${describeSceneTarget(res.openScene)}, перехода не будет`
            : `openScene → не найдена: ${describeSceneTarget(res.openScene)}`,
      );
    }
    setTestResult({kind: "ok", text: parts.length ? parts.join("\n") : "Код выполнен, действий нет"});
  };

  const outcome: ScriptTestOutcome = testResult && (testResult.kind === "error"
    ? {kind: "error", text: testResult.message}
    : {kind: "ok", text: testResult.text});

  const handleSave = () => {
    if (!code.trim() || syntaxError) return;
    const nextHandler: ElementEventHandler = {code, propertyRefs};
    const nextEvents: ElementEvents = [
      ...(element.events ?? []).filter(e => e.event_type !== event),
      {event_type: event, handler: nextHandler},
    ];
    useEditorStore.getState().updateElement(element.key, {events: nextEvents});
    closeModal();
  };

  return {...draft, otherScenes, setPropertyCall, runTest, outcome, handleSave, closeModal};
}
