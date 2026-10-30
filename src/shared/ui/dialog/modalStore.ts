import {create} from "zustand/react";
import {ReactNode} from "react";
import type {DialogSize} from "./DialogFrame";

interface ModalOptions {
  /** Ширина окна (`DialogFrame`). По умолчанию `xl`. */
  size?: DialogSize;
  /** false — клик по затемнению не закрывает окно. */
  closeOnOverlay?: boolean;
}

export interface ModalEntry {
  /** Место окна в стеке. Не меняется, когда `openModal` подменяет в нём содержимое. */
  id: number;
  /** Ключ содержимого: подменили — содержимое монтируется заново, со своим состоянием. */
  contentKey: number;
  content: ReactNode;
  size: DialogSize;
  closeOnOverlay: boolean;
}

interface ModalState {
  /** Открытые окна, снизу вверх. Рисует `ModalRoot`. */
  stack: ModalEntry[];
  /**
   * Открыть окно ВМЕСТО верхнего (или первым, если окон нет). Так стор работал, пока был
   * одноместным: окно, открытое из другого окна, встаёт на его место.
   */
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  /** Открыть окно ПОВЕРХ верхнего: закрыли — снова видно нижнее, с тем, что в нём набрано. */
  pushModal: (content: ReactNode, options?: ModalOptions) => void;
  /** Закрыть верхнее окно. */
  closeModal: () => void;
  /** Закрыть конкретное окно стека — им пользуется `useCloseModal`. */
  closeModalById: (id: number) => void;
}

let nextKey = 0;

const entryOf = (id: number, content: ReactNode, options?: ModalOptions): ModalEntry => ({
  id,
  contentKey: nextKey++,
  content,
  size: options?.size ?? "xl",
  closeOnOverlay: options?.closeOnOverlay ?? true,
});

export const useModalStore = create<ModalState>((set) => ({
  stack: [],
  openModal: (content, options) =>
    set((s) => {
      const top = s.stack.at(-1);
      if (!top) return {stack: [entryOf(nextKey++, content, options)]};
      return {stack: [...s.stack.slice(0, -1), entryOf(top.id, content, options)]};
    }),
  pushModal: (content, options) =>
    set((s) => ({stack: [...s.stack, entryOf(nextKey++, content, options)]})),
  closeModal: () => set((s) => ({stack: s.stack.slice(0, -1)})),
  closeModalById: (id) => set((s) => ({stack: s.stack.filter((e) => e.id !== id)})),
}));

/** Открыто ли хоть одно окно стека (для кода вне React — горячие клавиши редактора). */
export const isModalOpen = (): boolean => useModalStore.getState().stack.length > 0;
