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
import {useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {toast} from "sonner";

interface Props {
  onLoadAction: (value: number) => void;
  sceneList: {id: number; name: string}[];
  projectName?: string;
}

export function ChooseSceneContent({onLoadAction, sceneList, projectName}: Props) {
  const {closeModal} = useModalStore.getState();
  const [selectedValue, setSelectedValue] = useState<string>(String(sceneList[0]?.id ?? ""));

  const handleConfirm = () => {
    if (!selectedValue) return;
    onLoadAction(Number(selectedValue));
    closeModal();
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Выберите схему для загрузки
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        {projectName
          ? `Схемы проекта «${projectName}».`
          : "Загрузите одну из сохранённых сцен."}
      </Dialog.Description>

      {sceneList.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          В этом проекте пока нет схем. Создайте новую через кнопку «Создать» на панели инструментов.
        </p>
      ) : (
        <Select.Root
          value={selectedValue}
          onValueChange={setSelectedValue}
        >
          <Select.Trigger className={selectTriggerClassName}>
            <Select.Value placeholder="Выберите сцену..." />
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
                  {sceneList.map((scene) => (
                    <SelectItem key={scene.id} value={String(scene.id)}>
                      {scene.name}
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
      )}

      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-600 transition-colors"
        >
          Отмена
        </button>
        {sceneList.length > 0 && (
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-gray-900 dark:text-white shadow-lg shadow-indigo-900/30 transition-all"
          >
            Выбрать
          </button>
        )}
      </div>
    </>
  );
}

export function openChooseSceneModal() {
  const {openModal} = useModalStore.getState();
  const {loadScene, sceneList, currentProject} = useEditorStore.getState();
  const {loadPaletteItems} = usePaletteStore.getState();

  const handleLoadScene = async (id: number) => {
    await loadScene(id);
    await loadPaletteItems();
  };

  if (!currentProject) {
    toast.info("Сначала выберите проект");
    return;
  }

  openModal(
    <ChooseSceneContent
      onLoadAction={handleLoadScene}
      sceneList={sceneList}
      projectName={currentProject?.name}
    />
  );
}
