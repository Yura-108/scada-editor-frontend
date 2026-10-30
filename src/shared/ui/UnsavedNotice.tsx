"use client";

import React from "react";
import {AlertTriangle, RotateCcw, Save} from "lucide-react";
import {Banner} from "@/shared/ui/Banner";
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

/**
 * Плашка в левом нижнем углу, пока есть несохранённые правки. Заменяет надпись «есть
 * несохранённые правки» в шапке: там её не замечали, а уход со страницы молча терял работу.
 * Показывает её владелец — только когда правки действительно есть.
 */
export function UnsavedNotice({details, onSave, onDiscard, saving = false, saveBlockedReason}: Props) {
  return (
    <Banner
      layout="floating"
      tone="warning"
      icon={AlertTriangle}
      title="Есть несохранённые изменения"
      className="fixed bottom-4 left-4 z-toolbar max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-xl py-3 shadow-xl"
    >
      {details && <div className="text-xs text-muted-foreground">{details}</div>}
      {saveBlockedReason && <div className="text-xs text-destructive">{saveBlockedReason}</div>}
      {(onSave || onDiscard) && (
        <div className="flex gap-2 mt-2">
          {onSave && (
            <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !!saveBlockedReason}>
              <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
            </Button>
          )}
          {onDiscard && (
            <Button size="sm" onClick={onDiscard} disabled={saving} title="Отказаться от правок и перечитать с сервера">
              <RotateCcw size={14} />Отменить
            </Button>
          )}
        </div>
      )}
    </Banner>
  );
}
