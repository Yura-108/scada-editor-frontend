"use client";

import React, {useEffect, useMemo, useState} from "react";
import {GitBranch, KeyRound, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Users} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {AccessLevelSelect} from "@/components/ui/AccessLevelSelect";
import {passwordProblem} from "@/components/auth/ChangePasswordModal";
import {useEditorStore} from "@/store/useEditorStore";
import {useSessionUserStore} from "@/store/useSessionUserStore";
import {
  createUser,
  deleteUser,
  fetchBranches,
  fetchUserGrants,
  listUsers,
  putBranches,
  putUserGrant,
  resetUserPassword,
  resyncAccess,
  updateUser,
  type AdminUser,
  type UserGrants,
} from "@/lib/access/adminApi";
import {NO_GRANT, type ProjectGrant} from "@/types/access.types";

type Tab = "users" | "branches";

const inputClass =
  "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm "
  + "focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

const LOGIN_MIN = 3;
const LOGIN_MAX = 50;

const sameGrant = (a: ProjectGrant, b: ProjectGrant) =>
  a.view === b.view && a.operate === b.operate && a.edit === b.edit
  && (a.operate ? (a.level ?? 1) : null) === (b.operate ? (b.level ?? 1) : null);

/**
 * Администрирование (только админ): пользователи, их права в проектах, ветки каталога
 * проектов и перепубликация прав. Регистрации нет — пользователей заводит администратор.
 */
export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("users");
  const [resyncing, setResyncing] = useState(false);

  const handleResync = async () => {
    setResyncing(true);
    try {
      await resyncAccess();
      toast.success("Права перепубликованы на сервисах");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
        <ShieldCheck size={16} className="text-indigo-500" />
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Администрирование</span>
        {([["users", "Пользователи", Users], ["branches", "Ветки каталога", GitBranch]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm",
              tab === key ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          onClick={() => void handleResync()}
          disabled={resyncing}
          title="Перепубликовать права из базы auth на все сервисы — если права где-то не применились"
        >
          {resyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Обновить права на сервисах
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === "users" ? <UsersTab /> : <BranchesTab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const myLogin = useSessionUserStore(s => s.login);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then(list => { if (!cancelled) setUsers(list); })
      .catch(err => { if (!cancelled) setError((err as Error).message); });
    return () => { cancelled = true; };
  }, []);

  const selected = users?.find(u => u.id === selectedId) ?? null;
  const replaceUser = (user: AdminUser) => setUsers(list => list?.map(u => (u.id === user.id ? user : u)) ?? list);

  return (
    <div className="h-full grid grid-cols-[minmax(260px,320px)_1fr] min-h-0">
      <aside className="border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0">
        <CreateUserForm onCreated={user => { setUsers(list => [...(list ?? []), user]); setSelectedId(user.id); }} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && <p className="m-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!users && !error && <p className="m-3 text-sm text-neutral-500">Загрузка…</p>}
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {users?.map(u => (
              <li key={u.id}>
                <button
                  onClick={() => setSelectedId(u.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                    selectedId === u.id ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  )}
                >
                  <span className={cn("min-w-0 flex-1 truncate", !u.enabled && "line-through text-neutral-400")}>{u.login}</span>
                  {u.login === myLogin && <span className="text-[10px] text-neutral-400">это вы</span>}
                  {u.admin && <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400">админ</span>}
                  {!u.enabled && <span className="rounded-full bg-neutral-500/15 px-1.5 py-0.5 text-[10px] text-neutral-500">отключён</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <section className="min-h-0 overflow-y-auto">
        {selected ? (
          <UserDetails
            key={selected.id}
            user={selected}
            onChanged={replaceUser}
            onDeleted={() => { setUsers(list => list?.filter(u => u.id !== selected.id) ?? list); setSelectedId(null); }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500">Выберите пользователя</div>
        )}
      </section>
    </div>
  );
}

function CreateUserForm({onCreated}: {onCreated: (user: AdminUser) => void}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmed = login.trim();
  const problem = trimmed.length < LOGIN_MIN || trimmed.length > LOGIN_MAX
    ? `Логин — от ${LOGIN_MIN} до ${LOGIN_MAX} символов`
    : passwordProblem(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const user = await createUser(trimmed, password, admin);
      toast.success(`Пользователь «${user.login}» создан. Выдайте ему права в проектах`);
      setLogin("");
      setPassword("");
      setAdmin(false);
      onCreated(user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => void submit(e)} className="p-3 space-y-2 border-b border-neutral-200 dark:border-neutral-800">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Новый пользователь</div>
      <input className={cn(inputClass, "w-full")} placeholder="Логин" autoComplete="off" value={login} onChange={e => setLogin(e.target.value)} />
      <input className={cn(inputClass, "w-full")} placeholder="Пароль" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} />
          Администратор
        </label>
        <Button type="submit" variant="primary" className="px-3 py-1.5" disabled={saving || !!problem} title={problem ?? undefined}>
          <Plus size={14} />Создать
        </Button>
      </div>
    </form>
  );
}

function UserDetails({user, onChanged, onDeleted}: {user: AdminUser; onChanged: (u: AdminUser) => void; onDeleted: () => void}) {
  const [busy, setBusy] = useState(false);

  const patch = async (next: {enabled: boolean; admin: boolean}) => {
    setBusy(true);
    try {
      onChanged(await updateUser(user.id, next));
    } catch (err) {
      // 409 — последний администратор: текст бэкенда объясняет.
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const password = await promptModal({
      title: `Новый пароль для «${user.login}»`,
      description: "Пользователь войдёт с ним и сможет сменить его в меню пользователя.",
      label: "Новый пароль (6–100 символов)",
      confirmLabel: "Сбросить пароль",
    });
    if (password == null) return;
    const problem = passwordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      await resetUserPassword(user.id, password);
      toast.success("Пароль сброшен");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmModal({
      title: `Удалить пользователя «${user.login}»?`,
      description: "Учётная запись и все её права в проектах будут удалены. Отключить пользователя можно и без удаления.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(user.id);
      toast.success(`Пользователь «${user.login}» удалён`);
      onDeleted();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-semibold">{user.login}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={user.enabled} disabled={busy}
            onChange={e => void patch({enabled: e.target.checked, admin: user.admin})} />
          Включён
        </label>
        <label className="flex items-center gap-2 text-sm" title="Администратору можно всё, уровень 10">
          <input type="checkbox" checked={user.admin} disabled={busy}
            onChange={e => void patch({enabled: user.enabled, admin: e.target.checked})} />
          Администратор
        </label>
        <div className="flex-1" />
        <Button className="px-3 py-1.5" onClick={() => void handleResetPassword()}><KeyRound size={14} />Сбросить пароль</Button>
        <Button variant="danger" className="px-3 py-1.5" onClick={() => void handleDelete()}><Trash2 size={14} />Удалить</Button>
      </div>
      {user.admin
        ? <p className="text-sm text-neutral-500">Администратору доступно всё во всех проектах (уровень 10); права по проектам не нужны.</p>
        : <GrantsTable userId={user.id} />}
    </div>
  );
}

/** Права пользователя по проектам: строка — проект, сохраняется построчно. */
function GrantsTable({userId}: {userId: number}) {
  const projectList = useEditorStore(s => s.projectList);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
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
                <tr key={p.id} className={dirty ? "bg-amber-500/5" : undefined}>
                  <td className="px-3 py-1.5">{p.name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" aria-label={`Просмотр в «${p.name}»`} checked={g.view} onChange={e => setDraft(p.id, {view: e.target.checked})} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" aria-label={`Управление в «${p.name}»`} checked={g.operate}
                      onChange={e => setDraft(p.id, {operate: e.target.checked, level: e.target.checked ? (g.level ?? 1) : null})} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <AccessLevelSelect
                      value={g.operate ? (g.level ?? 1) : null}
                      emptyLabel={g.operate ? null : "—"}
                      disabled={!g.operate}
                      onChange={level => setDraft(p.id, {level})}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" aria-label={`Правка в «${p.name}»`} checked={g.edit} onChange={e => setDraft(p.id, {edit: e.target.checked})} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {dirty && (
                      <Button variant="primary" className="px-2.5 py-1 text-xs" disabled={savingId === p.id} onClick={() => void save(p.id)}>
                        {savingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Сохранить
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

/** Ветки каталога проекта: какие узлы базы каналов видят и правят его пользователи. */
function BranchesTab() {
  const projectList = useEditorStore(s => s.projectList);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    setLoading(true);
    fetchBranches(projectId)
      .then(list => {
        if (cancelled) return;
        const joined = list.join("\n");
        setText(joined);
        setSavedText(joined);
      })
      .catch(err => !cancelled && toast.error((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectId]);

  const save = async () => {
    if (projectId == null) return;
    const branches = text.split("\n").map(s => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      await putBranches(projectId, branches);
      const joined = [...new Set(branches)].join("\n");
      setText(joined);
      setSavedText(joined);
      toast.success("Ветки каталога сохранены");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <p className="text-sm text-neutral-500">
        Ветки определяют, какие узлы базы каналов видят и правят пользователи проекта: «правка» в проекте —
        правка узлов под ветками, «просмотр» — чтение. Без веток каталог для них пуст. Удалять корень ветки
        и узлы выше может только администратор.
      </p>
      <select className={inputClass} value={projectId ?? ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}>
        <option value="" disabled>Проект…</option>
        {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {projectId != null && (
        loading ? <p className="text-sm text-neutral-500">Загрузка…</p> : (
          <>
            <textarea
              className={cn(inputClass, "w-full h-48 font-mono")}
              placeholder={"По одной ветке в строке, например:\nБарановичи-1.BN1_MCA1"}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button variant="primary" className="px-4 py-2" disabled={saving || text === savedText} onClick={() => void save()}>
                <Save size={14} />{saving ? "Сохранение…" : "Сохранить ветки"}
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
