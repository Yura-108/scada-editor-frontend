'use client';

import Link from 'next/link';
import { ArrowLeft, Home, SearchX } from 'lucide-react';

/**
 * Страница 404.
 *
 * Сдержанный вид вместо градиента purple→pink→red с прыгающими «Sparkles» и
 * подписью «Ой-ой! Страница пропала в космосе»: для промышленной SCADA такой
 * тон неуместен, а половина текста была нечитаемой — `text-gray-900` поверх
 * яркого фона в светлой теме.
 *
 * Шапки здесь нет: корневой not-found рендерится вне группы (app), поэтому
 * ссылка «На главную» — единственный способ вернуться, и она на месте.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border">
          <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ошибка 404
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Страница не найдена
        </h1>
        <p className="mt-3 text-muted-foreground">
          Проверьте адрес — возможно, раздел был переименован или удалён.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/channels"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90"
          >
            <Home className="h-4 w-4" />
            На главную
          </Link>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться назад
          </button>
        </div>
      </div>
    </div>
  );
}
