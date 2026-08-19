import { create } from "zustand";
import type { ChoiceModalOptions, ConfirmModalOptions, PromptModalOptions } from "@/types/confirm.types";

export type ConfirmEntry =
  | {
      id: number;
      kind: "confirm";
      options: ConfirmModalOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      kind: "prompt";
      options: PromptModalOptions;
      resolve: (value: string | null) => void;
    }
  | {
      id: number;
      kind: "choice";
      options: ChoiceModalOptions;
      /** id выбранного варианта либо null — диалог закрыли без выбора. */
      resolve: (value: string | null) => void;
    };

interface ConfirmState {
  /**
   * Стек диалогов подтверждения.
   *
   * Отдельный от `modalStore` стек нужен, потому что тот держит РОВНО ОДНО
   * содержимое: подтверждение, открытое из уже открытой модалки (например,
   * «Записать рецепт в ПЛК» внутри ApplyRecipeModal), вытеснило бы родителя.
   * Radix спокойно рендерит вложенные диалоги, поэтому здесь именно стек.
   */
  stack: ConfirmEntry[];
  push: (entry: Omit<ConfirmEntry, "id">) => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useConfirmStore = create<ConfirmState>((set) => ({
  stack: [],
  push: (entry) =>
    set((s) => ({stack: [...s.stack, {...entry, id: nextId++} as ConfirmEntry]})),
  remove: (id) => set((s) => ({stack: s.stack.filter((e) => e.id !== id)})),
}));
