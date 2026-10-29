"use client";

import React, {useState} from "react";
import {KeyRound, LogOut, Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {confirmModal, promptModal} from "@/shared/ui/dialog/confirmModal";
import {passwordProblem} from "@/components/auth/ChangePasswordModal";
import {logoutToLogin, useSessionUserStore} from "@/core/access";
import {deleteUser, resetUserPassword, revokeUserSessions, updateUser, type AdminUser} from "../api/adminApi";
import {GrantsTable} from "./GrantsTable";
import {Checkbox} from "@/shared/ui/field/Checkbox";

export function UserDetails({user, onChanged, onDeleted}: {user: AdminUser; onChanged: (u: AdminUser) => void; onDeleted: () => void}) {
  const [busy, setBusy] = useState(false);
  const myLogin = useSessionUserStore(s => s.login);

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

  const handleRevokeSessions = async () => {
    const self = user.login === myLogin;
    const ok = await confirmModal({
      title: `Завершить сеансы «${user.login}»?`,
      description: self
        ? "Все ваши входы, включая этот, закончатся сразу — придётся войти заново."
        : "Все входы пользователя закончатся сразу, на всех устройствах: ему придётся войти заново.",
      confirmLabel: "Завершить сеансы",
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeUserSessions(user.id);
      toast.success("Сеансы завершены");
      if (self) await logoutToLogin();
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
        <Checkbox
          checked={user.enabled}
          disabled={busy}
          onChange={e => void patch({enabled: e.target.checked, admin: user.admin})}
          label="Включён"
        />
        <Checkbox
          title="Администратору можно всё, уровень 10"
          checked={user.admin}
          disabled={busy}
          onChange={e => void patch({enabled: user.enabled, admin: e.target.checked})}
          label="Администратор"
        />
        <div className="flex-1" />
        <Button size="sm" onClick={() => void handleResetPassword()}><KeyRound size={14} />Сбросить пароль</Button>
        <Button size="sm" onClick={() => void handleRevokeSessions()}><LogOut size={14} />Завершить сеансы</Button>
        <Button variant="danger" size="sm" onClick={() => void handleDelete()}><Trash2 size={14} />Удалить</Button>
      </div>
      {user.admin
        ? <p className="text-sm text-neutral-500">Администратору доступно всё во всех проектах (уровень 10); права по проектам не нужны.</p>
        : <GrantsTable userId={user.id} />}
    </div>
  );
}
