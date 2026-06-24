import {create} from "zustand/react";
import {ReactNode} from "react";

interface ModalState {
  open: boolean;
  content: ReactNode | null;
  openKey: number;
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  open: false,
  content: null,
  openKey: 0,
  openModal: (content) => set((s) => ({open: true, content, openKey: s.openKey + 1})),
  closeModal: () => set({open: false, content: null}),
}));