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
  /**
   * `floating` — плашка в левом нижнем углу; `bar` — полоса под шапкой страницы, для
   * разделов, где угол занят рабочим полем (редактор скрипта задачи, #19 п. 5).
   */
  layout?: "floating" | "bar";
}

/**
 * Плашка в левом нижнем углу, пока есть несохранённые правки. Заменяет надпись «есть
 * несохранённые правки» в шапке: там её не замечали, а уход со страницы молча терял работу.
 * Показывает её владелец — только когда правки действительно есть.
 */
export function UnsavedNotice({details, onSave, onDiscard, saving = false, saveBlockedReason, layout = "floating"}: Props) {
  const buttons = (onSave || onDiscard) && <>
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
  </>;

  if (layout === "bar") {
    return (
      <Banner layout="bar" tone="warning" icon={AlertTriangle} title="Есть несохранённые изменения." actions={buttons}>
        {details && <span className="text-xs text-muted-foreground">{details}</span>}
        {saveBlockedReason && <span className="ml-2 text-xs text-destructive">{saveBlockedReason}</span>}
      </Banner>
    );
  }

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
      {buttons && <div className="flex gap-2 mt-2">{buttons}</div>}
    </Banner>
  );
}
