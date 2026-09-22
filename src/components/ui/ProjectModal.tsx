"use client";

import {useModalStore} from "@/store/modalStore";
import {cn} from "@/lib/utils";
import {Link2, Power, PowerOff, X} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {useState, useEffect} from "react";
import {useEditorStore, type EditorProject} from "@/store/useEditorStore";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {openAutobindModal} from "@/components/ui/OpenAutobindModal";
import {Button, ModalFooter} from "@/components/ui/Button";

async function selectProjectAndOpenScenes(
  projectId: number,
  projectName: string,
  opts?: {skipSceneFetch?: boolean},
) {
  const {setCurrentProject, loadSceneList} = useEditorStore.getState();
  // setCurrentProject сбрасывает sceneList в [] — сцены прошлого проекта не должны утечь.
  setCurrentProject({id: projectId, name: projectName});
  // Для ТОЛЬКО ЧТО созданного проекта сцен ещё нет — не запрашиваем их с бэкенда.
  // Иначе для «пустого» project_id бэкенд может вернуть чужие сцены, и модалка выбора
  // сцены покажет схемы другого проекта (после выбора откроется «другой проект»).
  // sceneList уже [] после setCurrentProject, поэтому откроется пустой список с
  // предложением создать первую схему — что и делает проект непустым.
  if (!opts?.skipSceneFetch) {
    await loadSceneList(projectId);
  }
  useModalStore.getState().closeModal();
  openChooseSceneModal();
}

export function ProjectContent() {
  const {closeModal} = useModalStore();
  const projectList = useEditorStore(state => state.projectList);
  const loadProjectList = useEditorStore(state => state.loadProjectList);
  const createProject = useEditorStore(state => state.createProject);
  const deleteProject = useEditorStore(state => state.deleteProject);
  const runtimeFlags = useEditorStore(state => state.projectRuntimeFlags);
  const loadProjectRuntimeFlag = useEditorStore(state => state.loadProjectRuntimeFlag);
  const setProjectInOperation = useEditorStore(state => state.setProjectInOperation);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  // Флаг эксплуатации приходит отдельным эндпоинтом на каждый проект: в списке проектов
  // бэкенд его не отдаёт. Список короткий, поэтому спрашиваем по одному.
  useEffect(() => {
    for (const proj of projectList) void loadProjectRuntimeFlag(proj.id);
  }, [projectList, loadProjectRuntimeFlag]);

  const handleToggleOperation = async (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    const next = !runtimeFlags[proj.id];
    if (!next) {
      // Вывод из эксплуатации гасит проект целиком: останавливаются серверные скрипты и
      // идущие процедуры (мойка прервётся на текущем шаге).
      const ok = await confirmModal({
        title: `Вывести «${proj.name}» из эксплуатации?`,
        description: "Рантайм остановит проект: прекратятся обработчики изменений и идущие "
          + "процедуры, мониторы этого проекта отключатся.",
        confirmLabel: "Вывести",
        danger: true,
      });
      if (!ok) return;
    }
    await setProjectInOperation(proj.id, next);
  };

  // Состояния занятости строке не заводим: диалог открывается через тот же `modalStore`,
  // то есть заменяет собой окно проектов, и «занятой» строки на экране не остаётся.
  const handleAutobind = (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    openAutobindModal(proj.id, proj.name);
  };

  useEffect(() => {
    if (projectList.length > 0 && !selectedValue) {
      setSelectedValue(String(projectList[0].id));
    }
  }, [projectList, selectedValue]);

  const handleConfirm = async () => {
    const proj = projectList.find(p => String(p.id) === selectedValue);
    if (!proj) return;
    await selectProjectAndOpenScenes(proj.id, proj.name);
  };

  const handleDelete = async (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    const ok = await confirmModal({
      title: `Удалить проект «${proj.name}»?`,
      description: "Проект и все его схемы со всеми элементами будут удалены. Действие необратимо.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    await deleteProject(proj.id);
    // Локальную копию списка не держим: projectList приходит из стора, deleteProject его
    // уже обновил. Сброс выбора отдаёт его эффекту выше — тот подставит первый оставшийся.
    if (selectedValue === String(proj.id)) setSelectedValue("");
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      const created = await createProject(trimmed);
      if (!created) return;
      setNewName("");
      // Новый проект ещё не содержит схем — пропускаем загрузку списка сцен.
      await selectProjectAndOpenScenes(created.id, created.name, {skipSceneFetch: true});
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">Выберите проект</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Выберите существующий проект или создайте новый. После выбора откроется список схем проекта.
      </Dialog.Description>
      {projectList.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Проектов пока нет. Создайте первый проект ниже.
        </p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
          {projectList.map(proj => (
            // Раньше это был выпадающий Select. Кнопку удаления в Select.Item вложить
            // нельзя (он сам интерактивен), поэтому строка — <li> с двумя кнопками,
            // ровно как в модалке выбора схемы.
            <li
              key={proj.id}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                selectedValue === String(proj.id)
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
              )}
            >
              <button
                type="button"
                aria-pressed={selectedValue === String(proj.id)}
                onClick={() => setSelectedValue(String(proj.id))}
                className="min-w-0 flex-1 truncate text-left cursor-pointer"
              >
                {proj.name}
              </button>
              <button
                type="button"
                aria-pressed={runtimeFlags[proj.id] === true}
                onClick={(e) => void handleToggleOperation(e, proj)}
                className={cn(
                  "ml-2 shrink-0 p-0.5 rounded transition-colors",
                  runtimeFlags[proj.id]
                    ? "text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                    : "text-neutral-400 hover:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
                )}
                title={runtimeFlags[proj.id]
                  ? "В эксплуатации: рантайм исполняет проект. Нажмите, чтобы вывести"
                  : "Не в эксплуатации: рантайм проект не исполняет. Нажмите, чтобы ввести"}
                aria-label={runtimeFlags[proj.id]
                  ? `Вывести проект «${proj.name}» из эксплуатации`
                  : `Ввести проект «${proj.name}» в эксплуатацию`}
              >
                {runtimeFlags[proj.id] ? <Power size={14} /> : <PowerOff size={14} />}
              </button>
              <button
                type="button"
                onClick={(e) => handleAutobind(e, proj)}
                className="ml-2 shrink-0 p-0.5 rounded text-neutral-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                title="Автопривязка к базе каналов"
                aria-label={`Автопривязка проекта «${proj.name}» к базе каналов`}
              >
                <Link2 size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => void handleDelete(e, proj)}
                className="ml-2 shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-neutral-400 hover:text-red-500 transition-colors"
                title="Удалить проект"
                aria-label={`Удалить проект «${proj.name}»`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Имя нового проекта"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
          className={cn(
            "flex-1 rounded-xl border border-gray-300 dark:border-gray-700/80",
            "bg-white dark:bg-gray-900/60 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100",
            "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          )}
        />
        <button
          onClick={() => void handleCreate()}
          disabled={!newName.trim() || isCreating}
          className="px-4 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
        >
          {isCreating ? "Создание..." : "Создать"}
        </button>
      </div>

      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={() => void handleConfirm()}
          disabled={projectList.length === 0 || !selectedValue}
        >
          Выбрать
        </Button>
      </ModalFooter>
    </>
  );
}

export function openProjectModal() {
  const {openModal} = useModalStore.getState();
  openModal(<ProjectContent />);
}
