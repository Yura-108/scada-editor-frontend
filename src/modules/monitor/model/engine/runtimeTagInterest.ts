"use client";

import {useSyncExternalStore} from "react";

/**
 * Теги, которые экран монитора показывает ВНЕ открытой сцены (инспектор объектов и т.п.).
 *
 * С подпиской на сцену (контракт 2026-10-08-ws-scene-subscription-contract.md) runtime шлёт в
 * `UPDATE.tags` только теги сцены плюс явный список `tags`. Панель, читающая значение тега не
 * со сцены, обязана зарегистрировать его здесь — иначе значение замрёт (а при смене подписки
 * сбросится в «нет данных»). Движок объединяет теги всех владельцев и переподписывается.
 *
 * Владельцев несколько, поэтому это реестр, а не одиночный слот runtimeEventBus.
 */

const byOwner = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();
const EMPTY: readonly string[] = [];
let union: readonly string[] = EMPTY;

const recompute = () => {
  const all = new Set<string>();
  for (const tags of byOwner.values()) for (const t of tags) all.add(t);
  const next = [...all].sort();
  // Тот же состав — та же ссылка: иначе движок переподписывался бы на каждый ре-рендер панели.
  if (next.length === union.length && next.every((t, i) => t === union[i])) return;
  union = next.length ? next : EMPTY;
  for (const l of listeners) l();
};

export const setRuntimeTagInterest = (owner: string, tags: readonly string[]) => {
  if (tags.length) byOwner.set(owner, tags);
  else byOwner.delete(owner);
  recompute();
};

export const clearRuntimeTagInterest = (owner: string) => {
  if (!byOwner.delete(owner)) return;
  recompute();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => union;
const getServerSnapshot = () => EMPTY;

/** Отсортированное объединение тегов всех владельцев; ссылка меняется только при смене состава. */
export const useRuntimeTagInterest = (): readonly string[] =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
