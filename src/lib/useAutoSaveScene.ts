import { useEffect } from "react";
import { hasUnsavedWork, useEditorStore } from "@/store/useEditorStore";

const AUTOSAVE_INTERVAL_MS = 10 * 60_000;

/**
 * Автосохранение сцены редактора **раз в 10 минут** (см. AUTOSAVE_INTERVAL_MS).
 *
 * «Корректность»:
 *  - сохраняет по интервалу, а не на каждое изменение;
 *  - только при наличии изменений — источником истины служит `isDirty` в сторе
 *    (раньше признак «грязности» жил в локальном ref этого хука и был не виден
 *    интерфейсу, поэтому показать индикатор сохранения было нечем);
 *  - только если есть валидная сцена, принадлежащая текущему проекту;
 *  - не накладывает сохранения (в сторе есть общий замок saveInFlight);
 *  - тихо (без тостов «Сохранено»), не сбрасывает выделение (keepView);
 *  - при ошибке `isDirty` остаётся true и попытка повторится на следующем тике.
 */
export function useAutoSaveScene(intervalMs: number = AUTOSAVE_INTERVAL_MS) {
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useEditorStore.getState();
      const { isDirty, isSaving, scene, currentProject, versionPreview } = state;

      if (!isDirty || isSaving) return;
      if (!scene || !currentProject) return;
      // В режиме просмотра на холсте лежит СТАРАЯ версия. Автосейв сработал бы без
      // участия человека и записал бы её поверх текущей сцены — молча потеряв работу.
      // В exportScene стоит такая же проверка; здесь она экономит лишний вызов.
      if (versionPreview) return;

      const belongsToProject = scene.project_id == null || scene.project_id === currentProject.id;
      if (!belongsToProject) return;

      void state.exportScene({ silent: true, keepView: true, kind: "AUTOSAVE" });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);
}

/**
 * Предупреждение браузера при уходе со страницы с несохранёнными изменениями.
 *
 * Автосохранение срабатывает раз в 10 минут, поэтому закрытие вкладки сразу
 * после правки молча теряло до 10 минут работы.
 *
 * Признак берём через `hasUnsavedWork`, а не из `isDirty`: во время просмотра версии
 * правки пользователя отложены в сторону, и голый `isDirty` показывает «чисто».
 */
export function useWarnOnUnsavedChanges() {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWork()) return;
      // Современные браузеры показывают собственный текст; важен сам факт
      // preventDefault + установки returnValue.
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
