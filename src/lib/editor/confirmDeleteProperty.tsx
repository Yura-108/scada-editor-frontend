"use client";

import React from "react";
import {toast} from "sonner";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "@/store/useEditorStore";
import {collectPropertyDependents} from "@/lib/editor/propertyDependents";
import type {PropertyCreateDto} from "@/types/tags.types";

/**
 * Единая точка удаления свойства: подтверждение с перечнем зависимостей → серверный
 * `deleteProperty`. Вход три (корзина на бирке, кнопка в форме, вкладка «Строки»), и
 * расходиться в том, о чём они предупреждают, им нельзя.
 *
 * Удаление уходит на сервер немедленно и НЕ откатывается Ctrl+Z (мутация вне истории
 * undo, см. deleteProperty) — об этом говорим прямо, потому что весь остальной
 * редактор ведёт себя ровно наоборот.
 */
export const confirmDeleteProperty = async (
  property: Pick<PropertyCreateDto, "id" | "name">,
  componentId: number,
): Promise<boolean> => {
  const {bindings, directBindings, events, leavesBindingsWithoutProperty} =
    collectPropertyDependents(useEditorStore.getState().elements, property.id, componentId);

  const name = property.name?.trim() || `#${property.id}`;
  const list = (items: string[]) => items.map(i => `«${i}»`).join(", ");

  const ok = await confirmModal({
    title: `Удалить свойство «${name}»?`,
    danger: true,
    confirmLabel: "Удалить",
    description: (
      <span className="space-y-2 block">
        <span className="block">
          Свойство будет удалено на сервере сразу — отменить это через Ctrl+Z нельзя.
        </span>
        {directBindings.length > 0 && (
          <span className="block">
            Прямые привязки {list(directBindings)} будут удалены целиком: без ссылки на свойство
            они нерабочие.
          </span>
        )}
        {bindings.length > 0 && (
          <span className="block">
            Из привязок {list(bindings)} исчезнет ссылка на свойство — код останется, его нужно
            поправить вручную.
          </span>
        )}
        {events.length > 0 && (
          <span className="block">
            То же и у обработчиков событий {list(events)}.
          </span>
        )}
        {leavesBindingsWithoutProperty && (
          <span className="block text-red-500 dark:text-red-400 font-medium">
            У элемента останутся привязки, но ни одного сохранённого свойства — схема перестанет
            сохраняться (бэкенд отклонит весь сейв), пока вы не добавите свойство заново или не
            удалите привязки.
          </span>
        )}
      </span>
    ),
  });

  if (!ok) return false;

  // deleteProperty бросает (как editProperty), а не глотает: 409 «схему успел изменить
  // кто-то другой» должен доехать до пользователя тостом, а вызывающий UI — узнать,
  // что удаление не состоялось, и не закрывать форму.
  try {
    await useEditorStore.getState().deleteProperty(property.id, componentId);
    return true;
  } catch (err: unknown) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : "Не удалось удалить свойство");
    return false;
  }
};
