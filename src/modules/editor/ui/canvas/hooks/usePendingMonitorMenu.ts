import { useCallback, useEffect, useRef } from "react";
import Konva from "konva";
import { useEditorStore } from "../../../model/editorStore";

/**
 * Монитор: меню, отложенное на окно двойного клика.
 *
 * Меню открывается под курсором, и второй клик двойного попал бы в его пункт, а не на
 * холст. Поэтому там, где двойной клик что-то значит, меню ждёт `Konva.dblClickWindow`;
 * второй клик в окне снимает его (`cancel`), и меню не показывается вовсе.
 */
export function usePendingMonitorMenu() {
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  /** Есть ли отложенное меню — то есть это второй клик в окне двойного. */
  const isPending = useCallback(() => pendingRef.current !== null, []);

  const schedule = useCallback((open: () => void) => {
    const sceneAt = useEditorStore.getState().scene?.id;
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      // Пока ждали, схему могли сменить (скриптом, вкладкой) — меню той уже не к месту.
      if (useEditorStore.getState().scene?.id !== sceneAt) return;
      open();
    }, Konva.dblClickWindow);
  }, []);

  return { isPending, cancel, schedule };
}
