import React, {useState} from "react";
import {AlertTriangle, LayoutTemplate} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {Spinner} from "@/shared/ui/Spinner";
import {useScenePlan} from "../../../api/assistant";
import {useEditorStore} from "../../../model/editorStore";
import {useChannelRoot} from "../../project/useChannelRoot";
import {ChannelRootPicker} from "../../project/ChannelRootPicker";
import {AssistantTaskField, isTaskValid} from "../AssistantTaskField";
import {ScenePlanPreview} from "./ScenePlanPreview";

/**
 * План сцены от помощника (`scenes/plan`) — только просмотр.
 *
 * Элементы плана — не компоненты редактора: формат для применения сервис пока не отдаёт
 * (`scada-hh7b`), поэтому из плана ничего не создаём.
 */
function ScenePlanContent() {
  const closeModal = useCloseModal();
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const channelRoot = useChannelRoot();
  const plan = useScenePlan(projectId);
  const [task, setTask] = useState("");

  const result = plan.data;
  const canRequest = Boolean(channelRoot.root) && isTaskValid(task) && !plan.isPending;

  return (
    <>
      <DialogHeader
        icon={<LayoutTemplate className="mt-1 h-5 w-5 shrink-0 text-primary" />}
        title="План сцены от помощника"
        description="Набросок раскладки по описанию. Только просмотр: создать из него элементы пока нельзя."
      />

      <DialogBody className="space-y-4">
        <ChannelRootPicker state={channelRoot} />
        <AssistantTaskField
          value={task}
          onChange={setTask}
          placeholder="Например: два индикатора уровня progress_bar — танк 1 и танк 2 с тегами уровня"
          disabled={plan.isPending}
        />

        {plan.isPending && <Spinner label="Помощник раскладывает сцену…" />}
        {plan.error && <Banner tone="warning" icon={AlertTriangle}>{plan.error.message}</Banner>}

        {result && !plan.isPending && (
          <div className="space-y-3">
            {result.issues.length > 0 && (
              <Banner tone="warning" icon={AlertTriangle} title="Замечания">
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </Banner>
            )}
            <ScenePlanPreview elements={result.elements} />
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1">Тип</th><th>Имя</th><th>x, y</th><th>w × h</th><th>Тег</th></tr>
              </thead>
              <tbody className="divide-y">
                {result.elements.map((el, i) => (
                  <tr key={i}>
                    <td className="py-1 font-mono">{el.type}</td>
                    <td>{el.name}</td>
                    <td className="tabular-nums">{el.x}, {el.y}</td>
                    <td className="tabular-nums">{el.w} × {el.h}</td>
                    <td className="font-mono break-all">{el.tag || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Закрыть</Button>
        <Button
          variant="primary"
          onClick={() => plan.mutate({channel_root: channelRoot.root, task: task.trim()})}
          disabled={!canRequest}
          title={channelRoot.root ? undefined : "Выберите базу каналов"}
        >
          {plan.isPending ? <Spinner /> : <LayoutTemplate size={14} />}
          {result ? "Предложить заново" : "Предложить"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function openScenePlanModal() {
  useModalStore.getState().openModal(<ScenePlanContent />, {size: "lg", closeOnOverlay: false});
}
