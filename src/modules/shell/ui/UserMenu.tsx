'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CircleHelp, KeyRound, User, ChevronRight } from 'lucide-react';
import LogoutButton from './LogoutButton';
import { useModalStore } from '@/shared/ui/dialog/modalStore';
import {
  setSectionHelpHidden,
  setAllSectionHelpHidden,
  useAnySectionHelpHidden,
} from '@/shared/lib/sectionHelpVisibility';
import { ChangePasswordModal } from './ChangePasswordModal';

// Известные разделы со справкой — для меню пользователя.
const HELP_SECTIONS: { id: string; label: string }[] = [
  { id: 'editor', label: 'Редактор' },
  { id: 'recipes', label: 'Рецепты' },
  { id: 'monitor-live', label: 'Монитор — Живые данные' },
  { id: 'monitor-procedures', label: 'Монитор — Процедуры' },
  { id: 'monitor-archive', label: 'Монитор — Архив' },
  { id: 'actions', label: 'Журнал действий' },
  { id: 'log', label: 'Логирование' },
  { id: 'channels', label: 'База каналов' },
  { id: 'automation-tasks', label: 'Автоматизация — Задачи' },
  { id: 'automation-watchdog', label: 'Автоматизация — Watchdog' },
  { id: 'automation-history', label: 'Автоматизация — История' },
  { id: 'data-tables', label: 'Данные — Таблицы' },
  { id: 'data-variables', label: 'Данные — Переменные' },
  { id: 'data-history', label: 'Данные — История' },
  { id: 'admin-users', label: 'Администрирование — Пользователи' },
  { id: 'admin-branches', label: 'Администрирование — Ветки' },
];

/** Меню пользователя в шапке: восстановление подсказок по разделу, смена пароля и выход. */
export default function UserMenu({ login }: { login: string }) {
  const openModal = useModalStore((s) => s.openModal);
  const anyHidden = useAnySectionHelpHidden();
  const [open, setOpen] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={login || 'Пользователь'}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60"
      >
        <User className="w-5 h-5" />
        <span className="hidden lg:inline max-w-40 truncate">{login}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-dropdown w-56 rounded-xl border border-border bg-card p-1 shadow-2xl"
        >
          {login && (
            <div className="px-4 py-2 text-xs text-muted-foreground truncate">
              Вы вошли как <b>{login}</b>
            </div>
          )}
          {anyHidden && (
            <>
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={showHelpMenu}
                onClick={() => setShowHelpMenu((v) => !v)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-muted-foreground hover:bg-accent/60 rounded-xl"
              >
                <CircleHelp className="w-5 h-5 shrink-0" aria-hidden />
                <span className="font-medium flex-1">Показывать подсказки</span>
                <ChevronRight
                  size={14}
                  className={showHelpMenu ? 'rotate-90' : undefined}
                  aria-hidden
                />
              </button>
              {showHelpMenu && (
                <div className="ml-2 mt-1 border-l border-border pl-2 space-y-1">
                  {HELP_SECTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSectionHelpHidden(id, false);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground rounded-lg"
                    >
                      <CircleHelp className="w-4 h-4 shrink-0" aria-hidden />
                      <span>{label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAllSectionHelpHidden(false);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-medium text-primary hover:bg-accent/60 rounded-lg"
                  >
                    <CircleHelp className="w-4 h-4 shrink-0" aria-hidden />
                    <span>Показать все подсказки</span>
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openModal(<ChangePasswordModal />, { size: 'sm', closeOnOverlay: false });
            }}
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
