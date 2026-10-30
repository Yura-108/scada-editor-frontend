"use client";

import React from "react";
import {Pin, PinOff, Plus, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {IconButton} from "@/shared/ui/IconButton";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {PickerSelect} from "@/shared/ui/field/PickerSelect";
import {useCurrentProjectGrant} from "@/core/access";
import {usePaletteStore} from "@/store/usePaletteStore";
import {usePinnedScenesStore} from "@/store/usePinnedScenesStore";
import {useEditorStore} from "../../model/editorStore";
import {openSceneGuarded} from "../../model/openScene";

/**
 * Выбор схемы в шапке редактора. Заменил окно «Выберите схему»: в строках — закрепление
 * (вкладки быстрого доступа для всех пользователей проекта) и удаление, создание — кнопкой
 * «+» рядом. Без права правки схемы только открываются. Переход к другой схеме спрашивает
 * про несохранённые правки (`openSceneGuarded`).
 */
export function ScenePicker({open, onOpenChange}: {open: boolean; onOpenChange: (open: boolean) => void}) {
  const {currentProject, scene, sceneList, deleteScene, createScene} = useEditorStore(useShallow(s => ({
    currentProject: s.currentProject, scene: s.scene, sceneList: s.sceneList,
    deleteScene: s.deleteScene, createScene: s.createScene,
  })));
  const canWrite = useCurrentProjectGrant().edit;
  const loadPaletteItems = usePaletteStore(s => s.loadPaletteItems);
  // Подписка, а не getState(): иконка скрепки обязана переключаться сразу по клику.
  const pins = usePinnedScenesStore(s => s.pins);
  const togglePin = usePinnedScenesStore(s => s.togglePin);
  const unpin = usePinnedScenesStore(s => s.unpin);
  // Закрепления общие для проекта, если бэкенд их хранит; иначе — только в этом браузере.
  const forAll = usePinnedScenesStore(s => s.supported) ? " для всех пользователей проекта" : "";

  const remove = async (item: {id: number; name: string}) => {
    onOpenChange(false);
    const ok = await confirmModal({
      title: `Удалить схему «${item.name}»?`,
      description: "Схема и все её элементы будут удалены. Действие необратимо.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    await deleteScene(item.id);
    // Удалённая схема не должна остаться вкладкой быстрого доступа.
    unpin(item.id);
  };

  // Имя спрашивает сама createScene. Палитра зависит от проекта — как при открытии схемы.
  const create = async () => {
    await createScene();
    await loadPaletteItems();
  };

  return (
    <div className="flex min-w-0 shrink items-center gap-1">
      <PickerSelect
        aria-label="Схема"
        placeholder="Схема…"
        className="w-56"
        disabled={!currentProject}
        title={currentProject ? undefined : "Сначала выберите проект"}
        value={scene ? String(scene.id) : null}
        valueLabel={scene?.name}
        open={open}
        onOpenChange={onOpenChange}
        onValueChange={v => void openSceneGuarded(Number(v))}
        emptyText={canWrite ? "В проекте пока нет схем — создайте первую кнопкой «+»" : "В проекте пока нет схем"}
        items={sceneList.map(item => {
          const pinned = pins.some(p => p.id === item.id);
          return {
            value: String(item.id),
            label: item.name,
            actions: canWrite && <>
              <IconButton
                icon={pinned ? PinOff : Pin}
                size="xs"
                pressed={pinned}
                title={pinned ? `Открепить схему${forAll}` : `Закрепить схему${forAll}`}
                label={pinned ? `Открепить схему «${item.name}»` : `Закрепить схему «${item.name}»`}
                onClick={() => togglePin({id: item.id, name: item.name})}
              />
              <IconButton
                icon={X}
                size="xs"
                variant="danger"
                title="Удалить схему"
                label={`Удалить схему «${item.name}»`}
                onClick={() => void remove(item)}
              />
            </>,
          };
        })}
      />
      {canWrite && currentProject && (
        <IconButton icon={Plus} label="Новая схема" variant="secondary" onClick={() => void create()} />
      )}
    </div>
  );
}
