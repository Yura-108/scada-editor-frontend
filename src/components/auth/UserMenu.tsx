"use client";

import React, {useEffect, useRef, useState} from "react";
import {KeyRound, User} from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";
import {useModalStore} from "@/store/modalStore";
import {ChangePasswordModal} from "@/components/auth/ChangePasswordModal";

/** Меню пользователя в шапке: логин, смена пароля, выход. */
export default function UserMenu({login}: {login: string}) {
  const openModal = useModalStore(s => s.openModal);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={login || "Пользователь"}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/5 dark:hover:bg-white/5"
      >
        <User className="w-5 h-5" />
        <span className="hidden lg:inline max-w-40 truncate">{login}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-dropdown w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-2xl">
          {login && <div className="px-4 py-2 text-xs text-gray-500 truncate">Вы вошли как <b>{login}</b></div>}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); openModal(<ChangePasswordModal />); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-600 dark:text-gray-400 hover:bg-gray-900/5 dark:hover:bg-white/5 rounded-xl"
          >
            <KeyRound className="w-5 h-5" />
            <span className="font-medium">Сменить пароль</span>
          </button>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
