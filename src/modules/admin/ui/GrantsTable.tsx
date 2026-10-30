"use client";

import React, {useEffect, useMemo, useState} from "react";
import {Save} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {Spinner} from "@/shared/ui/Spinner";
import {AccessLevelSelect} from "@/components/ui/AccessLevelSelect";
import {useOpenScene} from "@/core/project";
import {NO_GRANT, type ProjectGrant} from "@/types/access.types";
import {fetchUserGrants, putUserGrant, type UserGrants} from "../api/adminApi";
import {Checkbox} from "@/shared/ui/field/Checkbox";

const sameGrant = (a: ProjectGrant, b: ProjectGrant) =>
  a.view === b.view && a.operate === b.operate && a.edit === b.edit
  && (a.operate ? (a.level ?? 1) : null) === (b.operate ? (b.level ?? 1) : null);

/** Права пользователя по проектам: строка — проект, сохраняется построчно. */
export function GrantsTable({userId}: {userId: number}) {
  const projectList = useOpenScene(s => s.projectList);
  const loadProjectList = useOpenScene(s => s.loadProjectList);
  const [saved, setSaved] = useState<UserGrants | null>(null);
  const [drafts, setDrafts] = useState<UserGrants>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  // Админ видит все проекты: список и есть строки таблицы.
  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  useEffect(() => {
    let cancelled = false;
    fetchUserGrants(userId)
      .then(g => { if (!cancelled) { setSaved(g); setDrafts({}); } })
      .catch(err => !cancelled && setError((err as Error).message));
    return () => { cancelled = true; };
  }, [userId]);

  const rows = useMemo(() => [...projectList].sort((a, b) => a.name.localeCompare(b.name, "ru")), [projectList]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!saved) return <p className="text-sm text-neutral-500">Загрузка прав…</p>;

  const current = (projectId: number): ProjectGrant => drafts[projectId] ?? saved[projectId] ?? NO_GRANT;
  const setDraft = (projectId: number, patch: Partial<ProjectGrant>) => {
    const next = {...current(projectId), ...patch};
    setDrafts(d => {
      const out = {...d};
      if (sameGrant(next, saved[projectId] ?? NO_GRANT)) delete out[projectId];
      else out[projectId] = next;
      return out;
    });
  };

  const save = async (projectId: number) => {
    const grant = current(projectId);
    setSavingId(projectId);
    try {
      await putUserGrant(userId, projectId, grant);
      const empty = !grant.view && !grant.operate && !grant.edit;
      setSaved(s => {
        const out = {...s};
        if (empty) delete out[projectId];
        else out[projectId] = {...grant, level: grant.operate ? (grant.level ?? 1) : null};
        return out;
      });
      setDrafts(d => {
        const out = {...d};
        delete out[projectId];
        return out;
      });
      toast.success(empty ? "Права в проекте сняты" : "Права сохранены");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Права в проектах</div>
      <p className="text-xs text-neutral-500">
        Просмотр — открыть схемы в редакторе без сохранения; управление — действия в мониторе в пределах уровня;
        правка — всё в редакторе. Снятые галочки удаляют права в проекте.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Проект</th>
              <th className="px-3 py-2 text-center">Просмотр</th>
              <th className="px-3 py-2 text-center">Управление</th>
              <th className="px-3 py-2 text-center">Уровень</th>
              <th className="px-3 py-2 text-center">Правка</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(p => {
              const g = current(p.id);
              const dirty = drafts[p.id] !== undefined;
              return (
                <tr key={p.id} className={dirty ? "bg-warning/5" : undefined}>
                  <td className="px-3 py-1.5">{p.name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <Checkbox aria-label={`Просмотр в «${p.name}»`} checked={g.view} onChange={e => setDraft(p.id, {view: e.target.checked})} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Checkbox aria-label={`Управление в «${p.name}»`} checked={g.operate}
                      onChange={e => setDraft(p.id, {operate: e.target.checked, level: e.target.checked ? (g.level ?? 1) : null})} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <AccessLevelSelect
                      size="sm"
                      className="mx-auto"
                      value={g.operate ? (g.level ?? 1) : null}
                      emptyLabel={g.operate ? null : "—"}
                      disabled={!g.operate}
                      onChange={level => setDraft(p.id, {level})}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Checkbox aria-label={`Правка в «${p.name}»`} checked={g.edit} onChange={e => setDraft(p.id, {edit: e.target.checked})} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {dirty && (
                      <Button variant="primary" size="sm" className="px-2.5 text-xs" disabled={savingId === p.id} onClick={() => void save(p.id)}>
                        {savingId === p.id ? <Spinner size={12} /> : <Save size={12} />}Сохранить
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
