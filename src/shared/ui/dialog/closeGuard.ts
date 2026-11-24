import {useCallback, useContext, useEffect, useRef} from "react";
import {useModalStore} from "./modalStore";
import {ModalEntryContext} from "./useCloseModal";

/** Можно ли закрыть окно: `false` — остаться (например, пользователь передумал терять правки). */
type CloseGuard = () => boolean | Promise<boolean>;

/** Охрана закрытия по id окна стека. Вне стора: функцию не рендерят, а только зовут. */
const guards = new Map<number, CloseGuard>();

/**
 * Закрыть окно стека, спросив его охрану. Так закрывают крестик, Esc и щелчок по затемнению
 * (`ModalRoot`) и кнопка «Отмена» (`useRequestClose`). Сохранение закрывает окно напрямую —
 * `useCloseModal`, без вопроса.
 */
export async function requestCloseModal(id: number): Promise<void> {
  const guard = guards.get(id);
  if (guard && !(await guard())) return;
  guards.delete(id);
  useModalStore.getState().closeModalById(id);
}

/**
 * Спрашивать перед закрытием окна, в котором рендерится компонент: `guard` вызывается при
 * крестике, Esc, щелчке мимо и «Отмене» и решает, закрывать ли. Пример — форма с черновиком:
 * «Закрыть без сохранения?» (#11 п. 7).
 */
export function useModalCloseGuard(guard: CloseGuard): void {
  const id = useContext(ModalEntryContext);
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  });
  useEffect(() => {
    if (id === null) return;
    guards.set(id, () => latest.current());
    return () => { guards.delete(id); };
  }, [id]);
}

/** «Отмена» внутри окна: закрыть его через охрану (`useModalCloseGuard`). */
export function useRequestClose(): () => void {
  const id = useContext(ModalEntryContext);
  const closeModal = useModalStore((s) => s.closeModal);
  return useCallback(() => { if (id === null) closeModal(); else void requestCloseModal(id); }, [id, closeModal]);
}
