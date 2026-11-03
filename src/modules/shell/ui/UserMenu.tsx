"use client";

import React, {useEffect, useRef, useState} from "react";
import {KeyRound, User} from "lucide-react";
import LogoutButton from "./LogoutButton";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {ChangePasswordModal} from "./ChangePasswordModal";

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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60"
      >
        <User className="w-5 h-5" />
        <span className="hidden lg:inline max-w-40 truncate">{login}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-dropdown w-56 rounded-xl border border-border bg-card p-1 shadow-2xl">
          {login && <div className="px-4 py-2 text-xs text-muted-foreground truncate">Вы вошли как <b>{login}</b></div>}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); openModal(<ChangePasswordModal />, {size: "sm", closeOnOverlay: false}); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-left text-muted-foreground hover:bg-accent/60 rounded-xl"
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
