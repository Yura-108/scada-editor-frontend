"use client";

import React, {useId, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {toast} from "sonner";
import {useModalStore} from "@/store/modalStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {readBackendError} from "@/lib/access/accessErrors";

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
  const closeModal = useModalStore(s => s.closeModal);
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
      toast.success("Пароль изменён");
      closeModal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => void submit(e)} className="w-full max-w-md">
      <Dialog.Title className="text-xl font-semibold mb-1">Смена пароля</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Новый пароль — от {PASSWORD_MIN} до {PASSWORD_MAX} символов.
      </Dialog.Description>
      <div className="space-y-4">
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
      </div>
      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сменить пароль"}</Button>
      </ModalFooter>
    </form>
  );
}
