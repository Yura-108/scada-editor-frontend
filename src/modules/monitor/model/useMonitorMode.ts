import {useState} from "react";
import type {RuntimeMode} from "./engine/useRuntimeEngine";

/**
 * Режим монитора. «Архив» — воспроизведение сцены по архиву тегов: WS не подключается,
 * действия выключены. Смена проекта возвращает в живой режим: период и курсор принадлежали
 * прошлому. Режим помнится вместе с проектом, в котором его выбрали: для другого проекта он «живой».
 */
export function useMonitorMode(projectKey: number | null) {
  const [modeChoice, setModeChoice] = useState<{mode: RuntimeMode; project: number | null}>(
    {mode: "live", project: null},
  );
  const mode: RuntimeMode = modeChoice.project === projectKey ? modeChoice.mode : "live";
  const setMode = (m: RuntimeMode) => setModeChoice({mode: m, project: projectKey});
  return {mode, setMode, isArchive: mode === "archive"};
}
