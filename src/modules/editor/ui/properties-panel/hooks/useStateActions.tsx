import {toast} from "sonner";
import {DiagramElement} from "@/types/editorElement.type";
import {choiceModal, confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "../../../model/editorStore";

/** Добавление, удаление и переименование состояний элемента — с вопросами пользователю. */
export function useStateActions(element: DiagramElement) {
  const addComponentStateToSubtree = useEditorStore(s => s.addComponentStateToSubtree);
  const removeComponentStateFromSubtree = useEditorStore(s => s.removeComponentStateFromSubtree);
  const renameComponentStateInSubtree = useEditorStore(s => s.renameComponentStateInSubtree);
  const findStateUsages = useEditorStore(s => s.findStateUsages);
  const setCurrentComponentStateId = useEditorStore(s => s.setCurrentComponentStateId);

  const addComponentState = (value: string) => {
    const createdStateId = addComponentStateToSubtree(element.key, value);
    if (createdStateId) {
      setCurrentComponentStateId(element.key, createdStateId);
    }
  }

  const removeComponentState = async (stateName: string) => {
    const confirmed = await confirmModal({
      title: `Удалить состояние «${stateName}»?`,
      description: "Визуальные настройки этого состояния будут потеряны.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!confirmed) return;
    removeComponentStateFromSubtree(element.key, stateName);
  }

  const renameComponentState = async (stateName: string) => {
    const next = (await promptModal({
      title: "Переименовать состояние",
      label: "Название состояния",
      defaultValue: stateName,
      confirmLabel: "Сохранить",
    }))?.trim();
    if (!next || next === stateName) return;

    // Имена состояний обязаны быть уникальными: по имени идут find() в каскаде,
    // в рантайме и при запекании composition (побеждает первое совпадение), а
    // удаление сносит все одноимённые разом.
    if (element.states.some(s => s.name === next)) {
      toast.error(`Состояние «${next}» уже есть у этого элемента`);
      return;
    }

    // Имя состояния лежит в пользовательском коде строковым литералом
    // (setState("Авария")), и рантайм при несовпадении молча пропускает интент.
    const usages = findStateUsages(element.key, stateName);
    let rewriteCode = false;

    if (usages.length) {
      const choice = await choiceModal({
        title: `Переименовать «${stateName}» в «${next}»?`,
        description: (
          <div className="space-y-1">
            <p>Старое имя встречается в коде:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {usages.map((u, i) => (
                <li key={`${u.elementKey}-${i}`}>{u.elementLabel} — {u.where}</li>
              ))}
            </ul>
          </div>
        ),
        options: [
          {id: "rename-and-fix", label: "Переименовать и заменить в коде"},
          {
            id: "rename-only",
            label: "Переименовать без замены",
            description: "Скрипты со старым именем перестанут срабатывать",
            danger: true,
          },
        ],
      });
      if (!choice) return;
      rewriteCode = choice === "rename-and-fix";
    }

    renameComponentStateInSubtree(element.key, stateName, next, {rewriteCode});
  }

  return {addComponentState, removeComponentState, renameComponentState};
}
