import React, {useMemo} from "react";
import {cn} from "@/shared/lib/cn";
import {lineDiff} from "../../../lib/assistant/lineDiff";

/** Построчная разница старого и нового кода: удалённое — красным, добавленное — зелёным. */
export function ScriptDiffView({oldCode, newCode}: {oldCode: string; newCode: string}) {
  const lines = useMemo(() => lineDiff(oldCode, newCode), [oldCode, newCode]);
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border bg-muted py-1 text-xs font-mono">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            "px-3 whitespace-pre-wrap",
            line.kind === "del" && "bg-destructive/10 text-destructive",
            line.kind === "add" && "bg-success/10 text-success",
          )}
        >
          <span className="select-none opacity-60">{line.kind === "del" ? "− " : line.kind === "add" ? "+ " : "  "}</span>
          {line.text}
        </div>
      ))}
    </pre>
  );
}
