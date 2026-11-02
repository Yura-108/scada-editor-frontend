"use client";

import {useEffect, useRef} from "react";
import {choiceModal} from "@/shared/ui/dialog/confirmModal";

/**
 * Охрана несохранённых правок при переходе между разделами по шапке.
 *
 * App Router не умеет отменять переход сам, поэтому ссылки навигации спрашивают
 * `confirmLeave()` до `router.push`. Регистрируются только разделы, чей черновик живёт внутри
 * страницы и пропадает вместе с ней («Данные проекта», «Автоматизация»). Документ редактора
 * схем лежит в общем сторе и переход переживает — ему охрана не нужна, иначе был бы ложный
 * вопрос на каждом переходе.
 *
 * Закрытие и перезагрузку вкладки страницы по-прежнему ловят своим `beforeunload`; кнопки
 * «назад/вперёд» браузера сюда не попадают — их App Router не даёт перехватить.
 */
export interface UnsavedGuard {
  /** Что не сохранено — для текста вопроса: «таблицы», «задачи автоматизации». */
  label: () => string;
  isDirty: () => boolean;
  /** Сохранить; `false` — не получилось (ошибка проверки, конфликт), уходить нельзя. */
  save: () => Promise<boolean>;
}

const guards = new Map<string, UnsavedGuard>();

/**
 * Спросить, можно ли уйти. `true` — уходим (правок нет, их сохранили или от них отказались).
 */
export async function confirmLeave(): Promise<boolean> {
  const dirty = [...guards.values()].filter(g => g.isDirty());
  if (!dirty.length) return true;

  const choice = await choiceModal({
    title: "Есть несохранённые изменения",
    description: `Не сохранено: ${dirty.map(g => g.label()).join(", ")}. Если уйти без сохранения, они пропадут.`,
    options: [
      {id: "save", label: "Сохранить и перейти"},
      {id: "discard", label: "Не сохранять", description: "Изменения пропадут", danger: true},
    ],
    cancelLabel: "Остаться",
  });
  if (choice === "discard") return true;
  if (choice !== "save") return false;
  for (const guard of dirty) {
    if (!(await guard.save())) return false;
  }
  return true;
}

/**
 * Регистрирует охрану на время жизни компонента. Функции читаются через ref, так что
 * передавать можно обычные замыкания текущего рендера — регистрация не пересоздаётся.
 */
export function useUnsavedGuard(owner: string, guard: UnsavedGuard) {
  const ref = useRef(guard);
  useEffect(() => { ref.current = guard; });
  useEffect(() => {
    guards.set(owner, {
      label: () => ref.current.label(),
      isDirty: () => ref.current.isDirty(),
      save: () => ref.current.save(),
    });
    return () => { guards.delete(owner); };
  }, [owner]);
}

/**
 * Обработчик клика по ссылке навигации: обычный клик ждёт `confirmLeave`, а открытие в новой
 * вкладке (Ctrl/Cmd/Shift, средняя кнопка) пропускается — текущая страница при этом не уходит.
 */
export const guardedClick = (navigate: () => void) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (![...guards.values()].some(g => g.isDirty())) return;
  e.preventDefault();
  void confirmLeave().then(ok => { if (ok) navigate(); });
};
