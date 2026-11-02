import React from "react";
import {AlertTriangle, Sparkles} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {Spinner} from "@/shared/ui/Spinner";
import {AssistantTaskField} from "../AssistantTaskField";
import {useBulkScriptEdit} from "./useBulkScriptEdit";
import {ScriptPickList} from "./ScriptPickList";
import {ProposalList} from "./ProposalList";

/**
 * Массовая правка скриптов сцены помощником (`scripts/edit`).
 *
 * Помощник только предлагает: правки применяются к документу по выбору человека после
 * просмотра разницы и уходят на сервер обычным сохранением сцены.
 */
function BulkScriptEditContent() {
  const closeModal = useCloseModal();
  const state = useBulkScriptEdit(closeModal);
  const {task, setTask, canRequest, request, edit, chosen, proposals, apply} = state;
  const hasResult = Boolean(edit.data) && !edit.isPending;

  return (
    <>
      <DialogHeader
        icon={<Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" />}
        title="Правка скриптов помощником"
        description="Опишите, что поменять, и выберите скрипты сцены. Помощник предложит правки — применяются только отмеченные, после сохранения сцены."
      />

      <DialogBody className="space-y-4">
        <AssistantTaskField
          value={task}
          onChange={setTask}
          placeholder="Например: замени сцену 16316 на 17000, комментарий оставь"
          disabled={edit.isPending}
        />
        <ScriptPickList state={state} />

        {edit.isPending && (
          <Spinner label="Помощник просматривает скрипты — по доле секунды и больше на каждый…" />
        )}
        {edit.error && <Banner tone="warning" icon={AlertTriangle}>{edit.error.message}</Banner>}
        {hasResult && <ProposalList state={state} />}
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Закрыть</Button>
        <Button onClick={request} disabled={!canRequest}>
          {edit.isPending ? <Spinner /> : <Sparkles size={14} />}
          {hasResult ? "Предложить заново" : "Предложить"}
        </Button>
        {hasResult && proposals.length > 0 && (
          <Button variant="primary" onClick={apply} disabled={chosen.size === 0}>
            Применить выбранные ({chosen.size})
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function openBulkScriptEditModal() {
  useModalStore.getState().openModal(<BulkScriptEditContent />, {size: "lg", closeOnOverlay: false});
}
