"use client";

import React from "react";
import {MousePointerClick, X} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {useEditorStore} from "../../model/editorStore";

/**
 * Плашка над холстом, пока выбран элемент палитры: что делать дальше и как отменить. Раньше это
 * было только во всплывающей подсказке элемента палитры, и после щелчка по «Кругу» было
 * непонятно, почему он не появился (#10 п. 7).
 */
export function PlacementHint() {
  const name = useEditorStore((s) => (s.pendingPlacement ? s.pendingPlacement.name ?? "элемент" : null));
  if (name === null) return null;
  return (
    <div
      role="status"
      className="absolute bottom-4 left-1/2 z-toolbar flex -translate-x-1/2 items-center gap-2 rounded-lg border border-primary/30 bg-card/95 py-1.5 pl-3 pr-1.5 text-sm text-foreground shadow-lg backdrop-blur"
    >
      <MousePointerClick size={16} className="shrink-0 text-primary" />
      <span>
        Щёлкните по холсту, чтобы поставить «{name}». <span className="text-muted-foreground">Esc — отмена</span>
      </span>
      <IconButton icon={X} size="xs" label="Отменить постановку" onClick={() => useEditorStore.getState().setPendingPlacement(null)} />
    </div>
  );
}
