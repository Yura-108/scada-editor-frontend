import {createContext, useCallback, useContext} from "react";
import {useModalStore} from "./modalStore";

/** id окна стека, внутри которого рендерится содержимое. Ставит `ModalRoot`. */
export const ModalEntryContext = createContext<number | null>(null);

/**
 * Закрыть то окно, в котором находится компонент. `closeModal` закрывает верхнее —
 * пока окно одно, это одно и то же, но под открытым поверх него окном (`pushModal`)
 * нижнее закрыло бы чужое.
 */
export function useCloseModal(): () => void {
  const id = useContext(ModalEntryContext);
  const closeModal = useModalStore((s) => s.closeModal);
  const closeModalById = useModalStore((s) => s.closeModalById);
  return useCallback(() => (id === null ? closeModal() : closeModalById(id)), [id, closeModal, closeModalById]);
}
