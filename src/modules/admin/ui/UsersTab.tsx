"use client";

import React, {useEffect, useState} from "react";
import {cn} from "@/shared/lib/cn";
import {useSessionUserStore} from "@/core/access";
import {listUsers, type AdminUser} from "../api/adminApi";
import {CreateUserForm} from "./CreateUserForm";
import {UserDetails} from "./UserDetails";

export function UsersTab() {
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
