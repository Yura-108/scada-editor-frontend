import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import type {VersionSummary} from "@/core/project";
import {
  fetchProjectData, fetchProjectDataVersions, ProjectDataSaveError, reloadProjectData, restoreProjectDataVersion,
  saveProjectData,
} from "../api/projectDataApi";
import type {ProjectDataSet, ProjectDataTable, ProjectDataValidationError} from "../types/projectData.types";
import {confirmRemoveTable} from "../ui/TablesEditor";
import {confirmRestoreDataVersion} from "../ui/confirmRestoreDataVersion";
import {offerReload} from "./offerReload";

/**
 * Таблицы данных проекта (`…/data`) — отдельный документ со своей версией: загрузка, правка,
 * сохранение с разбором ошибок проверки и 409, «Применить данные», история и восстановление.
 * Версии запрашиваются, только пока открыта вкладка истории (`historyOpen`).
 */
export function useTablesDocument(projectId: number | null, historyOpen: boolean) {
  const [data, setData] = useState<ProjectDataSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<ProjectDataValidationError[]>([]);
  const [invalidCells, setInvalidCells] = useState(0);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState(0);

  // Документ прежнего проекта сбрасывается при смене проекта во время рендера, а не в эффекте
  // (`set-state-in-effect`): эффект только загружает.
  const [loadedFor, setLoadedFor] = useState(projectId);
  if (loadedFor !== projectId) {
    setLoadedFor(projectId);
    setData(null);
  }

  const load = useCallback(
    () => projectId == null ? Promise.resolve() : fetchProjectData(projectId).then(
      (doc: ProjectDataSet) => {
        setData(doc);
        setDirty(false);
        setErrors([]);
      },
      err => { toast.error((err as Error).message); },
    ),
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** «Перечитать с сервера»: документ пропадает (спиннер), пока не придёт заново. */
  const reload = useCallback(async () => {
    setData(null);
    await load();
  }, [load]);

  useEffect(() => {
    if (!historyOpen || projectId == null) return;
    fetchProjectDataVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [historyOpen, projectId, data?.version]);

  const edit = (tables: ProjectDataTable[]) => {
    setData(d => (d ? {...d, tables} : d));
    setDirty(true);
  };

  /** `true` — сохранилось: охране ухода надо знать, можно ли уходить. */
  const save = async (): Promise<boolean> => {
    if (!data || projectId == null) return false;
    try {
      const saved = await saveProjectData(projectId, data.version, data.tables);
      setData(saved);
      setDirty(false);
      setErrors([]);
      toast.success(`Таблицы сохранены, версия ${saved.version}. Чтобы задачи увидели правку, нажмите «Применить данные»`);
      return true;
    } catch (err) {
      if (err instanceof ProjectDataSaveError && err.errors.length) {
        setErrors(err.errors);
        toast.error(`Таблицы не прошли проверку: ${err.errors.length}`);
      } else if (err instanceof ProjectDataSaveError && err.conflict) {
        toast.error(err.message);
        await offerReload("Таблицы", reload);
      } else {
        toast.error((err as Error).message);
      }
      return false;
    }
  };

  const removeSelectedTable = async () => {
    if (!data) return;
    const tables = await confirmRemoveTable(data.tables, selectedTable);
    if (!tables) return;
    edit(tables);
  };

  const apply = async () => {
    if (projectId == null) return;
    try {
      const result = await reloadProjectData(projectId);
      if (result === "applied") toast.success("Данные отправлены в automation");
      else toast.info("Проект сейчас не исполняется — данные подхватятся при его запуске");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const restore = async (versionNo: number) => {
    if (projectId == null || !data) return;
    const ok = await confirmRestoreDataVersion(projectId, versionNo, data.tables, data.version);
    if (!ok) return;
    try {
      await restoreProjectDataVersion(projectId, versionNo);
      await reload();
      toast.success(`Версия ${versionNo} восстановлена`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return {
    data, dirty, errors, invalidCells, setInvalidCells, versions, selectedTable, setSelectedTable,
    reload, edit, save, removeSelectedTable, apply, restore,
  };
}
