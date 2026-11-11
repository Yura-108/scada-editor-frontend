"use client";

import {useEffect, useState} from "react";
import {toast} from "sonner";
import {lastProjectId, useOpenScene} from "@/core/project";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {fetchBranches, fetchUserGrants, listUsers, putBranches} from "../api/adminApi";
import {addBranch, removeBranch, sameBranches} from "../lib/branchPaths";

/**
 * Логины не-администраторов с правами в проекте — им без веток каталог пуст. Спрашивается
 * только у проекта без веток: запрос прав идёт по каждому пользователю.
 */
function useUsersWithoutCatalog(projectId: number | null, noBranches: boolean): string[] {
  const [logins, setLogins] = useState<string[]>([]);
  useEffect(() => {
    if (projectId == null || !noBranches) return;
    let cancelled = false;
    (async () => {
      const users = (await listUsers()).filter(u => !u.admin && u.enabled);
      const withGrant = await Promise.all(users.map(async u => {
        const g = (await fetchUserGrants(u.id))[projectId];
        return g && (g.view || g.operate || g.edit) ? u.login : null;
      }));
      if (!cancelled) setLogins(withGrant.filter((l): l is string => l !== null).sort((a, b) => a.localeCompare(b, "ru")));
    })().catch(() => {
      // Предупреждение необязательное: без него раздел работает.
    });
    return () => { cancelled = true; };
  }, [projectId, noBranches]);
  return projectId != null && noBranches ? logins : [];
}

/** Ветки каталога выбранного проекта: загрузка, правка отметками, сохранение. */
export function useBranchesEditor() {
  const projectList = useOpenScene(s => s.projectList);
  const loadProjectList = useOpenScene(s => s.loadProjectList);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  // Проект подставляется сам — последний выбранный в других разделах, иначе первый.
  const fallbackId = projectList.length === 0 ? null
    : (projectList.find(p => p.id === lastProjectId()) ?? projectList[0]).id;
  const currentId = projectId ?? fallbackId;

  useEffect(() => {
    if (currentId == null) return;
    let cancelled = false;
    setLoading(true);
    fetchBranches(currentId)
      .then(list => {
        if (cancelled) return;
        const sorted = [...new Set(list)].sort((a, b) => a.localeCompare(b, "ru"));
        setBranches(sorted);
        setSaved(sorted);
      })
      .catch(err => !cancelled && toast.error((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [currentId]);

  const dirty = !sameBranches(branches, saved);

  const selectProject = async (id: number) => {
    if (id === currentId) return;
    if (dirty && !(await confirmModal({
      title: "Не сохранять ветки?",
      description: "Изменения веток текущего проекта пропадут.",
      confirmLabel: "Не сохранять",
      danger: true,
    }))) return;
    setProjectId(id);
  };

  const check = (key: string, checked: boolean) =>
    setBranches(prev => (checked ? addBranch(prev, key) : removeBranch(prev, key)));

  const save = async () => {
    if (currentId == null) return;
    setSaving(true);
    try {
      await putBranches(currentId, branches);
      setSaved(branches);
      toast.success("Ветки каталога сохранены");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const usersWithoutCatalog = useUsersWithoutCatalog(currentId, !loading && saved.length === 0);
  const projectName = projectList.find(p => p.id === currentId)?.name ?? "";

  return {
    projectList, projectId: currentId, projectName, selectProject,
    branches, setBranches, check, loading, saving, dirty, save,
    reset: () => setBranches(saved),
    usersWithoutCatalog,
  };
}
