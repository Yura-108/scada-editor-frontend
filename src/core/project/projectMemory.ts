/**
 * Последний выбранный проект — общий для разделов, как и сам `currentProject` в сторе.
 * Без этого после перезагрузки (и в мониторе, и в «Автоматизации») проект каждый раз
 * приходилось выбирать заново. Браузерная память: недоступна — просто не восстанавливаем.
 */
const PROJECT_KEY = "scada.lastProjectId";
const sceneKey = (projectId: number) => `monitor.lastScene.${projectId}`;

const readNumber = (key: string): number | null => {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // без памяти между заходами — не страшно
  }
};

export const rememberProject = (projectId: number) => write(PROJECT_KEY, projectId);
export const lastProjectId = (): number | null => readNumber(PROJECT_KEY);

/** Последняя открытая в мониторе схема проекта. */
export const rememberMonitorScene = (projectId: number, sceneId: number) => write(sceneKey(projectId), sceneId);
export const lastMonitorScene = (projectId: number): number | null => readNumber(sceneKey(projectId));

