'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'scada.section-help.hidden';
const CHANGE_EVENT = 'scada:section-help-visibility';
let hiddenOverride: boolean | null = null;

function readHidden() {
  try {
    return hiddenOverride ?? window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
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

export function useSectionHelpHidden() {
  return useSyncExternalStore(subscribe, readHidden, () => false);
}

export function setSectionHelpHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(KEY, hidden ? '1' : '0');
    hiddenOverride = null;
  } catch {
    // Если хранилище недоступно, настройка действует в текущей вкладке.
    hiddenOverride = hidden;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
