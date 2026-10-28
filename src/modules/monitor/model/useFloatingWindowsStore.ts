"use client";

import type {ReactNode} from "react";
import {create} from "zustand";

/**
 * Плавающие окна монитора («Опции» компонента, инспектор объектов).
 *
 * Не модалки: окно не затемняет экран и не перехватывает клики мимо себя — оператор держит его
 * открытым и смотрит схему, нажимает другие элементы, открывает ещё окна. Окна живут в слое
 * над холстом монитора (`FloatingWindowsLayer`), их можно перетаскивать за заголовок.
 *
 * Содержимое — уже готовый элемент: стор не знает, какие бывают окна, и не тянет их модули
 * (они сами импортируют стор, чтобы открыться).
 */
export type FloatingWindowKind = "options" | "inspector";

export interface FloatingWindow {
  /** Ключ окна: повторное открытие того же ключа поднимает окно наверх, а не плодит копию. */
  id: string;
  kind: FloatingWindowKind;
  title: string;
  content: ReactNode;
  /** Ширина, px. */
  width: number;
  /** Порядок наложения: больше — выше. */
  z: number;
  /** Меняется при замене содержимого — ключ React, чтобы окно начало с чистого состояния. */
  nonce: number;
}

interface FloatingWindowsState {
  windows: FloatingWindow[];
}

export const useFloatingWindowsStore = create<FloatingWindowsState>(() => ({windows: []}));

let zCounter = 1;
let nonceCounter = 1;

/** Открыть окно или, если оно уже открыто, заменить содержимое и поднять наверх. */
export function openFloatingWindow(win: Omit<FloatingWindow, "z" | "nonce">): void {
  const z = ++zCounter;
  const nonce = ++nonceCounter;
  useFloatingWindowsStore.setState(s => {
    const exists = s.windows.some(w => w.id === win.id);
    return {
      windows: exists
        ? s.windows.map(w => (w.id === win.id ? {...win, z, nonce} : w))
        : [...s.windows, {...win, z, nonce}],
    };
  });
}

export function closeFloatingWindow(id: string): void {
  useFloatingWindowsStore.setState(s => ({windows: s.windows.filter(w => w.id !== id)}));
}

/** Закрыть окна вида (например, «Опции» прошлой схемы) или все. */
export function closeFloatingWindows(kind?: FloatingWindowKind): void {
  useFloatingWindowsStore.setState(s => ({windows: kind ? s.windows.filter(w => w.kind !== kind) : []}));
}

/** Поднять окно наверх — по нажатию в нём. */
export function focusFloatingWindow(id: string): void {
  const top = useFloatingWindowsStore.getState().windows.reduce((m, w) => Math.max(m, w.z), 0);
  const win = useFloatingWindowsStore.getState().windows.find(w => w.id === id);
  if (!win || win.z === top) return;
  const z = ++zCounter;
  useFloatingWindowsStore.setState(s => ({windows: s.windows.map(w => (w.id === id ? {...w, z} : w))}));
}
