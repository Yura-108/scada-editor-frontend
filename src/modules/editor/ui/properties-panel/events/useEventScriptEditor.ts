import {useMemo, useState} from "react";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {compileEventScript, describeSceneTarget, executeEventScript, modernizeScopeCode, resolveSceneTarget} from "@/core/runtime";
import {getRenderedElement} from "@/core/scene";
import type {DiagramElement} from "@/types/editorElement.type";
import type {ElementEventHandler, ElementEventName, ElementEvents} from "@/types/binding.types";
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

  const runTest = () => {
    const handler: ElementEventHandler = {code, propertyRefs};
    const compiled = compileEventScript(element.key, handler, scope);
    if ("error" in compiled) {
      setTestResult({kind: "error", message: `Ошибка компиляции: ${compiled.error}`});
      return;
    }
    const {valuesByTagId, valuesByPropertyId} = draft.mockMaps();
    // runScript в тест-прогоне ничего не отправляет — только показывает, что ушло бы.
    const scriptCalls: string[] = [];
    const recordRunScript = (name: string, args?: Record<string, unknown>) =>
      scriptCalls.push(`runScript(${JSON.stringify(name)}${args ? `, ${JSON.stringify(args)}` : ""})`);
    const res = executeEventScript(
      compiled, valuesByTagId, valuesByPropertyId, getRenderedElement(element), recordRunScript,
    );
    if ("error" in res) {
      setTestResult({kind: "error", message: `Ошибка исполнения: ${res.error}`});
      return;
    }
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
