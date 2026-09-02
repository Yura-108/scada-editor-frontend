"use client";

import React from "react";
import {toast} from "sonner";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "@/store/useEditorStore";
import {collectPropertyDependents} from "@/lib/editor/propertyDependents";
import type {PropertyCreateDto} from "@/types/tags.types";

/**
 * Единая точка удаления свойства: подтверждение с перечнем зависимостей → локальный
 * `deleteProperty`. Вход три (корзина на бирке, кнопка в форме, вкладка «Строки»), и
 * расходиться в том, о чём они предупреждают, им нельзя.
 *
 * Удаление теперь обычная правка сцены: откатывается Ctrl+Z и уезжает на сервер вместе
 * со следующим сохранением. Предупреждаем поэтому не про необратимость, а про то, что
 * ломается по ссылкам.
 */
export const confirmDeleteProperty = async (
  property: PropertyCreateDto,
  elementKey: string,
): Promise<boolean> => {
  const elements = useEditorStore.getState().elements;
  const owner = elements.find(el => el.key === elementKey);

  // Черновик (свойство ещё не уезжало на сервер): ссылок по номеру на него быть не может,
  // разбирать зависимости не о чем.
  if (property.id == null || owner?.id == null) {
    const okDraft = await confirmModal({
      title: `Удалить свойство «${property.name?.trim() || "без имени"}»?`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!okDraft) return false;
    useEditorStore.getState().deleteProperty(elementKey, property);
    return true;
  }

  const componentId = owner.id;

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
    useEditorStore.getState().deleteProperty(elementKey, property);
    return true;
  } catch (err: unknown) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : "Не удалось удалить свойство");
    return false;
  }
};
