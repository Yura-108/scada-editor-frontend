import {useEffect} from "react";
import {closeFloatingWindows} from "./useFloatingWindowsStore";

/**
 * Плавающие окна монитора. «Опции» принадлежат компоненту открытой схемы — на другой схеме их
 * компонента нет. Инспектор от схемы не зависит, но смена проекта, вход в архив (записи там
 * невозможны) и уход со страницы закрывают всё.
 */
export function useMonitorWindows(sceneId: unknown, projectKey: number | null, isArchive: boolean) {
  useEffect(() => { closeFloatingWindows("options"); }, [sceneId]);
  useEffect(() => { closeFloatingWindows(); }, [projectKey, isArchive]);
  useEffect(() => () => closeFloatingWindows(), []);
}
