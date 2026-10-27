"use client";

import {useState} from "react";
import {Plus} from "lucide-react";

interface Props {
  placeholder: string;
  /** @returns создано ли — только тогда поле очищается. */
  onCreate: (name: string) => Promise<boolean>;
}

/** Футер списка проекта или схемы: имя и «Создать». */
export function CreateField({placeholder, onCreate}: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (await onCreate(trimmed)) setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        className="flex-1 min-w-0 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!name.trim() || busy}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
      >
        <Plus size={14} />{busy ? "Создание…" : "Создать"}
      </button>
    </div>
  );
}
