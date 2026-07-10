import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import type { DiagramElement } from "@/types/editorElement.type";

const AUTOSAVE_INTERVAL_MS = 60_000; // раз в минуту

/**
 * Автосохранение сцены редактора раз в минуту.
 *
 * «Корректность»:
 *  - сохраняет по интервалу, а не на каждое изменение;
 *  - только при наличии изменений (сравнение ссылки на массив `elements` —
 *    любая правка схемы создаёт новый массив, а пан/зум/выделение — нет);
 *  - только если есть валидная сцена, принадлежащая текущему проекту;
 *  - не накладывает сохранения (guard от параллельного запроса);
 *  - тихо (без тостов «Сохранено»), не сбрасывает выделение (keepView);
 *  - при ошибке оставляет изменения «грязными» и повторяет на следующем тике.
 */
export function useAutoSaveScene(intervalMs: number = AUTOSAVE_INTERVAL_MS) {
  const savedElementsRef = useRef<DiagramElement[] | null>(null);
  const savingRef = useRef(false);

  // Смена сцены → сбрасываем baseline, чтобы только что загруженная сцена
  // не считалась изменённой.
  const sceneId = useEditorStore(s => s.scene?.id ?? null);
  useEffect(() => {
    savedElementsRef.current = useEditorStore.getState().elements;
  }, [sceneId]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (savingRef.current) return;

      const state = useEditorStore.getState();
      const { elements, scene, currentProject } = state;

      if (!scene || !currentProject) return;

      const belongsToProject = scene.project_id == null || scene.project_id === currentProject.id;
      if (!belongsToProject) return;

      // Нет изменений с последнего сохранения — пропускаем тик.
      if (elements === savedElementsRef.current) return;

      savingRef.current = true;
      try {
        const ok = await state.exportScene({ silent: true, keepView: true });
        if (ok) {
          // baseline := elements после сохранения (loadScene вернул новый массив).
          savedElementsRef.current = useEditorStore.getState().elements;
        }
      } finally {
        savingRef.current = false;
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);
}
