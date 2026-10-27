"use client";

import {Pin, PinOff, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {usePinnedScenesStore} from "@/store/usePinnedScenesStore";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "../../model/editorStore";

const iconBtn = "shrink-0 p-0.5 rounded transition-colors";

/** Кнопки строки схемы: закрепить и удалить. Только с правом правки проекта. */
export function SceneRowActions({scene}: {scene: {id: number; name: string}}) {
  // Подписка, а не getState(): иконка скрепки обязана переключаться сразу по клику.
  const pinned = usePinnedScenesStore(s => s.pins.some(p => p.id === scene.id));
  const togglePin = usePinnedScenesStore(s => s.togglePin);
  // Закрепления общие для проекта, если бэкенд их хранит; иначе — только в этом браузере.
  const pinsShared = usePinnedScenesStore(s => s.supported);
  const deleteScene = useEditorStore(s => s.deleteScene);

  const handleDelete = async () => {
    const ok = await confirmModal({
      title: `Удалить схему «${scene.name}»?`,
      description: "Схема и все её элементы будут удалены. Действие необратимо.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    await deleteScene(scene.id);
    // Удалённая схема не должна остаться вкладкой быстрого доступа.
    usePinnedScenesStore.getState().unpin(scene.id);
  };

  const forAll = pinsShared ? " для всех пользователей проекта" : "";

  return (
    <>
      {/* Закрепление — вкладки быстрого доступа для всех пользователей проекта (в
          редакторе и мониторе). Менять их можно только здесь, в редакторе. */}
      <button
        type="button"
        aria-pressed={pinned}
        onClick={() => togglePin({id: scene.id, name: scene.name})}
        className={cn(iconBtn, pinned
          ? "text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          : "text-neutral-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40")}
        title={pinned ? `Открепить схему${forAll}` : `Закрепить схему${forAll}`}
        aria-label={pinned ? `Открепить схему «${scene.name}»` : `Закрепить схему «${scene.name}»`}
      >
        {pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        className={cn(iconBtn, "text-neutral-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40")}
        title="Удалить схему"
        aria-label={`Удалить схему «${scene.name}»`}
      >
        <X size={14} />
      </button>
    </>
  );
}
