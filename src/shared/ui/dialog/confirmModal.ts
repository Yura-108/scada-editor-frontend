import { useConfirmStore } from "./confirmStore";
import type { ChoiceModalOptions, ConfirmModalOptions, PromptModalOptions } from "./confirm.types";

export type { ChoiceModalOptions, ConfirmModalOptions, PromptModalOptions };

/**
 * Промис-обёртка вместо нативного `confirm()`. Окна рисует `ConfirmRoot`.
 *
 * Нативный диалог не стилизуется, игнорирует тему, блокирует поток и в ряде
 * окружений (кросс-доменный iframe) подавляется браузером — для необратимых
 * операций вроде записи рецепта в ПЛК это неприемлемо.
 *
 * @example if (!(await confirmModal({title: "Удалить?", danger: true}))) return;
 */
export function confirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().push({kind: "confirm", options, resolve});
  });
}

/** Промис-обёртка вместо нативного `prompt()`. Резолвится `null` при отмене. */
export function promptModal(options: PromptModalOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useConfirmStore.getState().push({kind: "prompt", options, resolve});
  });
}

/**
 * Выбор из нескольких действий. Резолвится id варианта либо `null` при отмене.
 *
 * Нужен там, где исходов больше двух и `confirmModal` пришлось бы натягивать на «да/нет»:
 * например, импорт в непустую схему — заменить, добавить или передумать. Прятать третий
 * исход за Esc нельзя, когда один из вариантов теряет работу пользователя.
 */
export function choiceModal(options: ChoiceModalOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useConfirmStore.getState().push({kind: "choice", options, resolve});
  });
}
