"use client";

import React, {useState} from "react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {logoutToLogin, readBackendError} from "@/core/access";

const RELOGIN_DELAY_MS = 1500;

/** Те же пределы, что проверяет auth (`ChangePasswordDto`). */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

export const passwordProblem = (password: string): string | null =>
  password.length < PASSWORD_MIN ? `Пароль — не короче ${PASSWORD_MIN} символов`
    : password.length > PASSWORD_MAX ? `Пароль — не длиннее ${PASSWORD_MAX} символов`
      : null;

/** Смена своего пароля: `PUT /api/auth/me/password` → 204, неверный текущий — 400. */
export function ChangePasswordModal() {
  const closeModal = useCloseModal();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const problem = !oldPassword ? "Введите текущий пароль"
    : passwordProblem(newPassword)
      ?? (newPassword !== repeat ? "Пароли не совпадают" : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({oldPassword, newPassword}),
      });
      if (!res.ok) {
        setError(await readBackendError(res));
        return;
      }
      // Смена пароля гасит все сеансы, и текущий тоже: на вход сразу, не дожидаясь 401.
      // Пауза — чтобы тост успел показаться до перезагрузки страницы.
      toast.success("Пароль изменён, войдите заново");
      closeModal();
      setTimeout(() => void logoutToLogin(), RELOGIN_DELAY_MS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Форма — колонка окна: шапка, прокручиваемое тело и подвал с кнопкой отправки.
    <form onSubmit={e => void submit(e)} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader
        title="Смена пароля"
        description={<>Новый пароль — от {PASSWORD_MIN} до {PASSWORD_MAX} символов.</>}
      />
      <DialogBody className="space-y-4">
        <Field label="Текущий пароль">
          <Input type="password" autoComplete="current-password"
            value={oldPassword} onChange={e => { setOldPassword(e.target.value); setError(null); }} />
        </Field>
        <Field label="Новый пароль">
          <Input type="password" autoComplete="new-password"
            value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(null); }} />
        </Field>
        <Field label="Повторите новый пароль">
          <Input type="password" autoComplete="new-password"
            value={repeat} onChange={e => { setRepeat(e.target.value); setError(null); }} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сменить пароль"}</Button>
      </DialogFooter>
    </form>
  );
}
