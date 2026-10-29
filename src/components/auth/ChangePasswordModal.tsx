"use client";

import React, {useId, useState} from "react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
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

export const fieldInput =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm "
  + "focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

/** Смена своего пароля: `PUT /api/auth/me/password` → 204, неверный текущий — 400. */
export function ChangePasswordModal() {
  const closeModal = useCloseModal();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = {old: useId(), next: useId(), repeat: useId()};

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
        <div>
          <label htmlFor={ids.old} className="block text-xs font-medium text-gray-500 mb-1">Текущий пароль</label>
          <input id={ids.old} type="password" autoComplete="current-password" className={fieldInput}
            value={oldPassword} onChange={e => { setOldPassword(e.target.value); setError(null); }} />
        </div>
        <div>
          <label htmlFor={ids.next} className="block text-xs font-medium text-gray-500 mb-1">Новый пароль</label>
          <input id={ids.next} type="password" autoComplete="new-password" className={fieldInput}
            value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(null); }} />
        </div>
        <div>
          <label htmlFor={ids.repeat} className="block text-xs font-medium text-gray-500 mb-1">Повторите новый пароль</label>
          <input id={ids.repeat} type="password" autoComplete="new-password" className={fieldInput}
            value={repeat} onChange={e => { setRepeat(e.target.value); setError(null); }} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сменить пароль"}</Button>
      </DialogFooter>
    </form>
  );
}
