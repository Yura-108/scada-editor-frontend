'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'scada.section-help.hidden';
const CHANGE_EVENT = 'scada:section-help-visibility';
let hiddenOverride: Set<string> | null = null;

function readHidden(): Set<string> {
  try {
    if (hiddenOverride) return hiddenOverride;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

/** Проверить, скрыта ли справка для конкретного раздела. */
export function useSectionHelpHidden(sectionId: string) {
  return useSyncExternalStore(
    subscribe,
    () => readHidden().has(sectionId),
    () => false,
  );
}

/** Проверить, скрыта ли справка вообще (для обратной совместимости). */
export function useAnySectionHelpHidden() {
  return useSyncExternalStore(
    subscribe,
    () => readHidden().size > 0,
    () => false,
  );
}

/** Скрыть/показать справку для конкретного раздела. */
export function setSectionHelpHidden(sectionId: string, hidden: boolean) {
  try {
    const set = readHidden();
    if (hidden) set.add(sectionId);
    else set.delete(sectionId);
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
    hiddenOverride = null;
  } catch {
    // Если хранилище недоступно, настройка действует в текущей вкладке.
    const set = hiddenOverride ?? new Set();
    if (hidden) set.add(sectionId);
    else set.delete(sectionId);
    hiddenOverride = set;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Скрыть/показать справку для всех разделов (для меню пользователя). */
export function setAllSectionHelpHidden(hidden: boolean) {
  try {
    if (hidden) {
      // Скрываем все известные разделы. Список может расширяться — лучше хранить явно.
      window.localStorage.setItem(KEY, JSON.stringify(['global']));
    } else {
      window.localStorage.removeItem(KEY);
    }
    hiddenOverride = null;
  } catch {
    hiddenOverride = hidden ? new Set(['global']) : new Set();
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
