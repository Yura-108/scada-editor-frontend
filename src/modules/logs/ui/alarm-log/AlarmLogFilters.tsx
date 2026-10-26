"use client";

import React from "react";
import {useShallow} from "zustand/react/shallow";
import {Loader2, RefreshCw} from "lucide-react";
import {Button} from "@/shared/ui/Button";
// переедет в shared/ui вместе с журналом действий (шаг 8)
import {
  journalFilterBar, journalInput as inputClass, JournalField, JournalPresets,
} from "@/components/journal/journalUi";
import type {AlarmLogEvent} from "../../alarmLog.types";
import {ALARM_EVENT_LABEL, ALARM_GROUPS} from "../../lib/alarmLog";
import {useAlarmLogFilterStore} from "../../model/alarmLogFilterStore";

interface AlarmLogFiltersProps {
  projects: readonly {id: number; name: string}[];
  /** Журнал по всем проектам — только администратору. */
  admin: boolean;
  loading: boolean;
  onSearch: () => void;
  onPreset: (ms: number) => void;
}

export function AlarmLogFilters({projects, admin, loading, onSearch, onPreset}: AlarmLogFiltersProps) {
  const s = useAlarmLogFilterStore(useShallow(st => ({
    draftFrom: st.draftFrom, draftTo: st.draftTo, projectId: st.projectId, group: st.group, event: st.event,
    setDraftFrom: st.setDraftFrom, setDraftTo: st.setDraftTo, setProjectId: st.setProjectId,
    setGroup: st.setGroup, setEvent: st.setEvent,
  })));

  return (
    <form className={journalFilterBar} onSubmit={e => { e.preventDefault(); onSearch(); }}>
      <JournalField label="С">
        <input type="datetime-local" className={inputClass} value={s.draftFrom} onChange={e => s.setDraftFrom(e.target.value)} />
      </JournalField>
      <JournalField label="По">
        <input type="datetime-local" className={inputClass} value={s.draftTo} onChange={e => s.setDraftTo(e.target.value)} />
      </JournalField>
      <JournalField label="Проект">
        <select
          className={inputClass}
          value={s.projectId ?? ""}
          onChange={e => s.setProjectId(e.target.value ? Number(e.target.value) : null)}
        >
          {admin ? <option value="">Все проекты</option> : s.projectId == null && <option value="" disabled>Проект…</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </JournalField>
      <JournalField label="Группа">
        <select className={inputClass} value={s.group} onChange={e => s.setGroup(e.target.value)}>
          <option value="">Все</option>
          {ALARM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </JournalField>
      <JournalField label="Событие">
        <select className={inputClass} value={s.event} onChange={e => s.setEvent(e.target.value as AlarmLogEvent | "")}>
          <option value="">Все</option>
          {(Object.keys(ALARM_EVENT_LABEL) as AlarmLogEvent[]).map(k => (
            <option key={k} value={k}>{ALARM_EVENT_LABEL[k]}</option>
          ))}
        </select>
      </JournalField>
      <Button type="submit" variant="primary" className="px-3 py-1.5 text-sm shadow-none" disabled={loading || (!admin && s.projectId == null)}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Показать
      </Button>
      <JournalPresets onPick={onPreset} />
    </form>
  );
}
