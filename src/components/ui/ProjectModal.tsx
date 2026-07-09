"use client";

import {useModalStore} from "@/store/modalStore";
import * as Select from "@radix-ui/react-select";
import {cn} from "@/lib/utils";
import {ChevronDown} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import SelectItem from "./SelectItem";
import {
  selectContentClassName,
  selectIconClassName,
  selectScrollButtonClassName,
  selectTriggerClassName,
} from "@/components/ui/selectStyles";
import {useState, useEffect} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";

async function selectProjectAndOpenScenes(projectId: number, projectName: string) {
  const {setCurrentProject, loadSceneList} = useEditorStore.getState();
  setCurrentProject({id: projectId, name: projectName});
  await loadSceneList(projectId);
  useModalStore.getState().closeModal();
  openChooseSceneModal();
}

export function ProjectContent() {
  const {closeModal} = useModalStore();
  const projectList = useEditorStore(state => state.projectList);
  const loadProjectList = useEditorStore(state => state.loadProjectList);
  const createProject = useEditorStore(state => state.createProject);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

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

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      const created = await createProject(trimmed);
      if (!created) return;
      setNewName("");
      await selectProjectAndOpenScenes(created.id, created.name);
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

      {projectList.length > 0 ? (
        <Select.Root value={selectedValue} onValueChange={setSelectedValue}>
          <Select.Trigger className={selectTriggerClassName}>
            <Select.Value placeholder="Выберите проект..." />
            <Select.Icon>
              <ChevronDown className={selectIconClassName} />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content position="popper" sideOffset={6} className={selectContentClassName}>
              <Select.ScrollUpButton className={selectScrollButtonClassName}>
                <ChevronDown className="h-4 w-4 rotate-180" />
              </Select.ScrollUpButton>
              <Select.Viewport className="p-1.5">
                <Select.Group>
                  {projectList.map((proj) => (
                    <SelectItem key={proj.id} value={String(proj.id)}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </Select.Group>
              </Select.Viewport>
              <Select.ScrollDownButton className={selectScrollButtonClassName}>
                <ChevronDown className="h-4 w-4" />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Проектов пока нет. Создайте первый проект ниже.
        </p>
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

      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-600 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={() => void handleConfirm()}
          disabled={projectList.length === 0 || !selectedValue}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-gray-900 dark:text-white shadow-lg shadow-indigo-900/30 transition-all disabled:opacity-40"
        >
          Выбрать
        </button>
      </div>
    </>
  );
}

export function openProjectModal() {
  const {openModal} = useModalStore.getState();
  openModal(<ProjectContent />);
}
