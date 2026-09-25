import {create} from "zustand/react";
import {ReactNode} from "react";

export type ModalVariant = "default" | "fullscreen";

interface ModalOptions {
  /** "fullscreen" — модалка почти во весь экран (редакторы кода). */
  variant?: ModalVariant;
}

interface ModalState {
  open: boolean;
  content: ReactNode | null;
  variant: ModalVariant;
  openKey: number;
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  open: false,
  content: null,
  variant: "default",
  openKey: 0,
  openModal: (content, options) =>
    set((s) => ({
      open: true,
      content,
      variant: options?.variant ?? "default",
      openKey: s.openKey + 1,
    })),
  closeModal: () => set({open: false, content: null, variant: "default"}),
}));
