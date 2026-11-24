import {useState} from "react";
import {useDeviceTreeStore} from "../model/deviceTreeStore";

/** Площадка проекта — первый сегмент его ключа (`площадка.проект`). */
export const siteOf = (projectKey: string) => projectKey.split('.')[0];

const sitesOf = (projects: string[] | null) => [...new Set((projects ?? []).map(siteOf))];

/**
 * Выбранные в пикере площадки и проекты. Идут за загруженным деревом (`loadedRootPath`):
 * возвращаясь в раздел, видим загруженное, а не пустые поля, и то же — когда дерево
 * загрузилось без пикера (восстановление после F5) или из него удалили проект.
 */
export function useProjectSelection() {
  const loadedRootPath = useDeviceTreeStore(s => s.loadedRootPath);

  const [selectedProjects, setSelectedProjects] = useState<string[]>(() => loadedRootPath ?? []);
  const [selectedSites, setSelectedSites] = useState<string[]>(() => sitesOf(loadedRootPath));

  // Подстройка состояния при рендере, а не в эффекте — без лишнего кадра со старым выбором.
  const [syncedPath, setSyncedPath] = useState(loadedRootPath);
  if (loadedRootPath !== syncedPath) {
    setSyncedPath(loadedRootPath);
    if (loadedRootPath) {
      setSelectedProjects(loadedRootPath);
      setSelectedSites(sitesOf(loadedRootPath));
    }
  }

  return {selectedSites, setSelectedSites, selectedProjects, setSelectedProjects};
}
