import {useCallback, useEffect, useId, useState} from "react";
import type {InspectorObjectDto} from "@/core/runtime";
import {useOpenScene} from "@/core/project";
import {fetchInspectorObjects} from "../../api/inspector";
import {clearRuntimeTagInterest, setRuntimeTagInterest} from "../engine/runtimeTagInterest";

/**
 * Список объектов инспектора и выбранный объект: загрузка по смене выпуска и по просьбе
 * (`reload`), регистрация тегов выбранного объекта в runtimeTagInterest.
 */
export function useInspectorObjects(initialObjectId: number | undefined) {
  const projectId = useOpenScene((s) => s.currentProject?.id ?? null);
  const releaseVersionNo = useOpenScene((s) => s.releaseVersionNo);

  const [objects, setObjects] = useState<InspectorObjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialObjectId ?? null);
  const [reloadKey, setReloadKey] = useState(0);

  // Перечитываем при смене выпуска: у нового выпуска могли смениться объекты и id свойств.
  // `reloadKey` — по UNKNOWN_PROPERTY: бэк сказал, что список устарел.
  const load = useCallback(async (signal: AbortSignal) => {
    if (projectId == null) return;
    return fetchInspectorObjects(projectId, signal);
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(list => {
        if (controller.signal.aborted || !list) return;
        setObjects(list);
        setLoadError(null);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, releaseVersionNo, reloadKey]);

  const selected = objects.find(o => o.id === selectedId) ?? null;

  // Объект может быть с другой сцены, а WS подписан только на открытую: теги выбранного
  // объекта просим явно (runtimeTagInterest), пока окно открыто. Весь список не просим —
  // объектов сотни, а значения видны только у выбранного.
  const interestOwner = useId();
  const selectedTagKey = (selected?.properties ?? [])
    .map(p => p.tag_id).filter((t): t is string => !!t).sort().join("\n");
  useEffect(() => {
    setRuntimeTagInterest(`inspector:${interestOwner}`, selectedTagKey ? selectedTagKey.split("\n") : []);
  }, [interestOwner, selectedTagKey]);
  useEffect(() => () => clearRuntimeTagInterest(`inspector:${interestOwner}`), [interestOwner]);

  const reload = () => setReloadKey(k => k + 1);

  return {objects, loading, loadError, selectedId, setSelectedId, selected, reload};
}
