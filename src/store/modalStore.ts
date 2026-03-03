import {create} from "zustand/react";
import {ReactNode} from "react";

interface ModalState {
  open: boolean;
  content: ReactNode | null;
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  open: false,
  content: null,
  openModal: (content) => set({open: true, content: content}),
  closeModal: () => set({open: false, content: null}),
}));