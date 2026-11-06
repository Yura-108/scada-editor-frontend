import React, {useCallback} from "react";
import {toast} from "sonner";
import {useDeviceTreeStore} from "@/core/devices";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import type {LogEntry} from "../types/logs.type";
import {logRevertSummary, type ParamTypeName} from "../lib/describeLog";

/** Сколько строк перечня показывать в подтверждении, остальное — «ещё N». */
const SHOWN = 5;

/**
 * «Отменить» в журнале. Сначала окно с перечнем того, что вернётся (#14 п. 3): раньше отмена
 * шла сразу по клику, а то, что запись из операции откатывает всю операцию, было сказано
 * только во всплывающей подсказке. Состав операции берётся из загруженного периода
 * (`all` — без фильтра по пользователю): сервер откатывает её целиком.
 */
export function useLogUndo(all: LogEntry[], typeName: ParamTypeName, refresh: () => Promise<unknown>) {
  return useCallback(async (log: LogEntry) => {
    const members = log.batchId != null
      ? all.filter(l => l.batchId === log.batchId && !l.undoneAt)
      : [log];
    const lines = (members.length ? members : [log]).map(l => logRevertSummary(l, typeName));

    const ok = await confirmModal({
      title: lines.length > 1 ? `Отменить операцию — ${lines.length} изменений?` : "Отменить изменение?",
      description: (
        <div className="space-y-2">
          <p>Вернётся:</p>
          <ul className="list-disc space-y-1 pl-5">
            {lines.slice(0, SHOWN).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          {lines.length > SHOWN && <p>…и ещё {lines.length - SHOWN}.</p>}
        </div>
      ),
      confirmLabel: "Отменить изменения",
      cancelLabel: "Оставить",
      danger: true,
      wide: true,
    });
    if (!ok) return;

    try {
      const res = log.batchId != null
        ? await fetch(`/api/logs/batch/${encodeURIComponent(log.batchId)}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
        })
        : await fetch('/api/logs/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(log.id),
        });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка при попытке отката');
      }

      toast.success(lines.length > 1 ? `Операция отменена: ${lines.length} изменений` : 'Изменение отменено');
      await refresh();
      // Базу каналов помечаем устаревшей — при следующем входе в /channels она пере-синхронизируется.
      useDeviceTreeStore.getState().markStale();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || 'Не удалось выполнить отмену');
      console.error('Ошибка при отмене:', err);
    }
  }, [all, typeName, refresh]);
}
