"use client";

import React, {useState} from "react";
import {Plus} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {PASSWORD_MIN, passwordProblem} from "@/core/access";
import {Field} from "@/shared/ui/field/Field";
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
  const loginProblem = trimmed.length < LOGIN_MIN || trimmed.length > LOGIN_MAX
    ? `Логин — от ${LOGIN_MIN} до ${LOGIN_MAX} символов`
    : null;
  const pwdProblem = passwordProblem(password);
  const problem = loginProblem ?? pwdProblem;

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
    <form onSubmit={e => void submit(e)} className="p-3 space-y-2 border-b border-border">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Новый пользователь</div>
      {/* Правила — под полями, ошибка — сразу при вводе. Раньше они были только в подсказке
          неактивной «Создать» (#19 п. 1). Пустое поле ещё не ошибка — пока просто правило. */}
      <Field size="sm" label="Логин" hint={`От ${LOGIN_MIN} до ${LOGIN_MAX} символов`} error={login && loginProblem}>
        <Input size="sm" autoComplete="off" value={login} onChange={e => setLogin(e.target.value)} />
      </Field>
      <Field size="sm" label="Пароль" hint={`Не короче ${PASSWORD_MIN} символов`} error={password && pwdProblem}>
        <Input size="sm" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <Checkbox checked={admin} onChange={e => setAdmin(e.target.checked)} label="Администратор" />
        <Button type="submit" variant="primary" size="sm" disabled={saving || !!problem} title={problem ?? undefined}>
          <Plus size={14} />Создать
        </Button>
      </div>
    </form>
  );
}
