"use client";

import React, {useState} from "react";
import {Plus} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {passwordProblem} from "@/components/auth/ChangePasswordModal";
import {createUser, type AdminUser} from "../api/adminApi";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Input} from "@/shared/ui/field/Input";

const LOGIN_MIN = 3;
const LOGIN_MAX = 50;

export function CreateUserForm({onCreated}: {onCreated: (user: AdminUser) => void}) {
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
      <Input size="sm" placeholder="Логин" autoComplete="off" value={login} onChange={e => setLogin(e.target.value)} />
      <Input size="sm" placeholder="Пароль" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <Checkbox checked={admin} onChange={e => setAdmin(e.target.checked)} label="Администратор" />
        <Button type="submit" variant="primary" size="sm" disabled={saving || !!problem} title={problem ?? undefined}>
          <Plus size={14} />Создать
        </Button>
      </div>
    </form>
  );
}
