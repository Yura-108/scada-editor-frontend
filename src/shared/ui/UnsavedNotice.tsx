"use client";

import React from "react";
import {AlertTriangle, RotateCcw, Save} from "lucide-react";
import {Button} from "@/shared/ui/Button";

interface Props {
  /** Что именно не сохранено: «таблицы», «задачи: 2, watchdog». */
  details?: React.ReactNode;
  onSave?: () => void;
  /** Отказаться от правок и перечитать с сервера. */
  onDiscard?: () => void;
  saving?: boolean;
  /** Почему сохранить сейчас нельзя (неверные ячейки и т. п.). */
  saveBlockedReason?: string | null;
}

const compact = "h-8 px-3 text-sm shadow-none whitespace-nowrap";

/**
 * Плашка в левом нижнем углу, пока есть несохранённые правки. Заменяет надпись «есть
 * несохранённые правки» в шапке: там её не замечали, а уход со страницы молча терял работу.
 * Показывает её владелец — только когда правки действительно есть.
 */
export function UnsavedNotice({details, onSave, onDiscard, saving = false, saveBlockedReason}: Props) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-toolbar max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-neutral-900 shadow-xl px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <div className="font-medium text-amber-900 dark:text-amber-200">Есть несохранённые изменения</div>
          {details && <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">{details}</div>}
          {saveBlockedReason && <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">{saveBlockedReason}</div>}
          {(onSave || onDiscard) && (
            <div className="flex gap-2 mt-2">
              {onSave && (
                <Button variant="primary" className={compact} onClick={onSave} disabled={saving || !!saveBlockedReason}>
                  <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
                </Button>
              )}
              {onDiscard && (
                <Button className={compact} onClick={onDiscard} disabled={saving} title="Отказаться от правок и перечитать с сервера">
                  <RotateCcw size={14} />Отменить
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
