import React from "react";
import {ChevronLeft, ChevronRight, Loader2, Radio} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {TREND_WINDOW_PRESETS} from "@/core/scene";
import {ARCHIVE_DEPTH_MS} from "../../model/archive/archive";
import {toLocalInput} from "../../lib/trendTime";

/** Управление периодом: длина окна, сдвиг на пол-окна, конец периода, «Сейчас», состояние загрузки. */
export function TrendPeriodBar({windowSec, setWindowSec, shift, follow, to, clockNow, setEndTs, loading, aggregated, error}: {
  windowSec: number;
  setWindowSec: (seconds: number) => void;
  shift: (dir: -1 | 1) => void;
  follow: boolean;
  to: number;
  clockNow: () => number;
  setEndTs: (ts: number | null) => void;
  loading: boolean;
  aggregated: boolean;
  error: string | null;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
        {TREND_WINDOW_PRESETS.map(p => (
          <button
            key={p.seconds}
            type="button"
            onClick={() => setWindowSec(p.seconds)}
            className={cn(
              "px-2.5 py-1 text-xs",
              windowSec === p.seconds
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => shift(-1)} title="Назад на пол-окна"
        className="rounded-lg p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800">
        <ChevronLeft size={16} />
      </button>
      <button type="button" onClick={() => shift(1)} disabled={follow} title="Вперёд на пол-окна"
        className="rounded-lg p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40">
        <ChevronRight size={16} />
      </button>

      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        Конец периода
        <input
          type="datetime-local"
          value={toLocalInput(to)}
          max={toLocalInput(clockNow())}
          onChange={e => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isNaN(ts)) return;
            setEndTs(ts >= clockNow() ? null : Math.max(ts, Date.now() - ARCHIVE_DEPTH_MS + windowSec * 1000));
          }}
          className="rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs"
        />
      </label>

      <button
        type="button"
        onClick={() => setEndTs(null)}
        aria-pressed={follow}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          follow
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-gray-500/10 text-gray-600 dark:text-gray-300 hover:bg-gray-500/20",
        )}
      >
        <Radio size={12} />
        Сейчас
      </button>

      {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      {aggregated && !loading && (
        <span className="text-xs text-amber-600 dark:text-amber-400" title="Архив вернул минимумы и максимумы по интервалам — пики сохранены">
          Данные прорежены — сузьте окно, чтобы увидеть каждое изменение
        </span>
      )}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
