import {create} from "zustand/react";
import {CSSProperties, ReactNode} from "react";

export type ModalVariant = "default" | "fullscreen";

interface ModalOptions {
  /** "fullscreen" — модалка почти во весь экран (редакторы кода). */
  variant?: ModalVariant;
  /**
   * Размер окна, заданный содержимым (width/height). Так «Опции» монитора открываются
   * в размере, заданном компоненту в редакторе. Только для варианта "default".
   */
  style?: CSSProperties;
}

interface ModalState {
  open: boolean;
  content: ReactNode | null;
  variant: ModalVariant;
  style: CSSProperties | undefined;
  openKey: number;
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  open: false,
  content: null,
  variant: "default",
  style: undefined,
  openKey: 0,
  openModal: (content, options) =>
    set((s) => ({
      open: true,
      content,
      variant: options?.variant ?? "default",
      style: options?.style,
      openKey: s.openKey + 1,
    })),
  closeModal: () => set({open: false, content: null, variant: "default", style: undefined}),
}));
