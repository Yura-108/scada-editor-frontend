"use client";

import {useModalStore} from "@/store/modalStore";
import {cn} from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {X} from "lucide-react";
import {useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {toast} from "sonner";

interface Props {
  onLoadAction: (value: number) => void;
  onDeleteAction: (id: number) => Promise<void>;
  onCreateAction?: (name: string) => Promise<{id: number; name: string} | null>;
  sceneList: {id: number; name: string}[];
  projectName?: string;
}

export function ChooseSceneContent({
  onLoadAction,
  onDeleteAction,
  onCreateAction,
  sceneList,
  projectName,
}: Props) {
  const {closeModal} = useModalStore.getState();
  const [localList, setLocalList] = useState(sceneList);
  const [selectedId, setSelectedId] = useState<number | null>(sceneList[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleConfirm = () => {
    if (selectedId === null) return;
    onLoadAction(selectedId);
    closeModal();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const ok = window.confirm('Вы уверены, что хотите удалить эту сцену? Это действие необратимо.');
    if (!ok) return;
    await onDeleteAction(id);
    const next = localList.filter(s => s.id !== id);
    setLocalList(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const handleCreate = async () => {
    if (!onCreateAction) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      const created = await onCreateAction(trimmed);
      if (!created) return;
      setNewName("");
      setLocalList(prev => {
        if (prev.some(s => s.id === created.id)) return prev;
        return [...prev, {id: created.id, name: created.name}];
      });
      setSelectedId(created.id);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Выберите схему для загрузки
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        {projectName
          ? `Схемы проекта «${projectName}». Выберите существующую или создайте новую.`
          : "Загрузите одну из сохранённых сцен или создайте новую."}
      </Dialog.Description>

      {localList.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          В этом проекте пока нет схем. Создайте первую ниже.
        </p>
      ) : (
        <ul className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
          {localList.map(scene => (
            <li
              key={scene.id}
              onClick={() => setSelectedId(scene.id)}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors",
                selectedId === scene.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
              )}
            >
              <span className="truncate">{scene.name}</span>
              <button
                onClick={(e) => handleDelete(e, scene.id)}
                className="ml-2 shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-neutral-400 hover:text-red-500 transition-colors"
                title="Удалить сцену"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {onCreateAction && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            placeholder="Имя новой схемы"
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
      )}

      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-600 transition-colors"
        >
          Отмена
        </button>
        {localList.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={selectedId === null}
            className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-gray-900 dark:text-white shadow-lg shadow-indigo-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
  const {loadScene, sceneList, currentProject, deleteScene, createScene} = useEditorStore.getState();
  const {loadPaletteItems} = usePaletteStore.getState();

  const handleLoadScene = async (id: number) => {
    await loadScene(id);
    await loadPaletteItems();
  };

  // Возвращаем null, если сцена не создана — тогда модалка не закрывается
  // и пользователь может поправить имя.
  const handleCreateScene = async (
    name: string,
  ): Promise<{id: number; name: string} | null> => {
    if (!currentProject) {
      toast.info("Сначала выберите проект");
      return null;
    }

    const created = await createScene(name);
    if (!created) {
      toast.error("Не удалось создать сцену");
      return null;
    }

    return created;
  };

  if (!currentProject) {
    toast.info("Сначала выберите проект");
    return;
  }

  openModal(
    <ChooseSceneContent
      onLoadAction={handleLoadScene}
      onDeleteAction={deleteScene}
      onCreateAction={handleCreateScene}
      sceneList={sceneList}
      projectName={currentProject?.name}
    />
  );
}
