import {useMemo, useState} from "react";
import {toast} from "sonner";
import {useScriptEdit} from "../../../api/assistant";
import {applyAssistantScriptEdits} from "../../../model/assistantEdits";
import {useEditorStore} from "../../../model/editorStore";
import {collectSceneScripts, type SceneScript} from "../../../lib/assistant/sceneScripts";
import {ASSISTANT_EDIT_MAX_CODE, ASSISTANT_EDIT_MAX_SCRIPTS} from "../../../types/assistant.types";
import {isTaskValid} from "../AssistantTaskField";

/** Скрипт слишком длинный для помощника — выбрать его нельзя (сервер ответил бы 400). */
export const isTooLong = (s: SceneScript) => s.code.length > ASSISTANT_EDIT_MAX_CODE;

/**
 * Массовая правка скриптов сцены: выбор скриптов, задание, предложения помощника и
 * применение выбранных. Скрипты собираются один раз при открытии окна: правки, сделанные
 * позже, ловит сверка с `old_code` при применении.
 */
export function useBulkScriptEdit(onDone: () => void) {
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const [scripts] = useState(() => collectSceneScripts(useEditorStore.getState().elements));
  const byId = useMemo(() => new Map(scripts.map(s => [s.id, s])), [scripts]);

  const [task, setTask] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(scripts.filter(s => !isTooLong(s)).map(s => s.id)));
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const edit = useScriptEdit(projectId);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const toggleSelected = (id: string) => setSelected(prev => toggle(prev, id));
  const setAllSelected = (on: boolean) =>
    setSelected(on ? new Set(scripts.filter(s => !isTooLong(s)).map(s => s.id)) : new Set());
  const toggleChosen = (id: string) => setChosen(prev => toggle(prev, id));

  const tooMany = selected.size > ASSISTANT_EDIT_MAX_SCRIPTS;
  const canRequest = isTaskValid(task) && selected.size > 0 && !tooMany && !edit.isPending;

  const request = () => {
    const payload = scripts.filter(s => selected.has(s.id)).map(s => ({id: s.id, code: s.code}));
    edit.mutate({task: task.trim(), scripts: payload}, {
      // По умолчанию не отмечено ничего: модель ошибается, и применять стоит то, что
      // человек просмотрел, а не всё подряд.
      onSuccess: () => setChosen(new Set()),
    });
  };

  // Предложения по скриптам, которых нет в нашем наборе, отбрасываем: применить их некуда.
  const proposals = (edit.data?.proposals ?? []).filter(p => byId.has(p.id));
  const rejected = (edit.data?.rejected ?? []).filter(r => byId.has(r.id));

  const apply = () => {
    const edits = proposals
      .filter(p => chosen.has(p.id))
      .map(p => ({id: p.id, oldCode: p.old_code, newCode: p.new_code}));
    const result = applyAssistantScriptEdits(edits);
    if (!result) return;
    if (result.stale.length) {
      toast.warning(`Пропущено ${result.stale.length}: код изменился после запроса — запросите заново`);
    }
    if (result.applied.length) {
      toast.success(`Применено правок: ${result.applied.length}. Сохраните сцену, чтобы они ушли на сервер`);
      onDone();
    }
  };

  return {
    scripts, byId, task, setTask, selected, toggleSelected, setAllSelected, tooMany,
    canRequest, request, edit, proposals, rejected, chosen, toggleChosen, apply,
  };
}

export type BulkScriptEdit = ReturnType<typeof useBulkScriptEdit>;
