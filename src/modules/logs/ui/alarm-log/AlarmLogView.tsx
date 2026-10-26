"use client";

import React, {useEffect, useMemo} from "react";
import {Loader2} from "lucide-react";
// переедет в shared/ui вместе с журналом действий (шаг 8)
import {journalPage, JournalTabs, JournalTitle} from "@/components/journal/journalUi";
import {useAlarmLogFilterStore} from "../../model/alarmLogFilterStore";
import {useAlarmLogSearch} from "../../model/useAlarmLogSearch";
import {AlarmLogFilters} from "./AlarmLogFilters";
import {AlarmLogTable} from "./AlarmLogTable";

interface AlarmLogViewProps {
  /** Доступные проекты; пусто — список ещё грузится. */
  projects: readonly {id: number; name: string}[];
  admin: boolean;
  /** Проект, открытый в мониторе/редакторе, — по умолчанию для не-администратора. */
  currentProjectId: number | null;
}

/** Журнал аварий ПЛК: возникновение, подтверждение, снятие, подавление. Только чтение. */
export function AlarmLogView({projects, admin, currentProjectId}: AlarmLogViewProps) {
  const ensureDefault = useAlarmLogFilterStore(s => s.ensureDefault);
  const {rows, isLoading, error, hasMore, loadMore, search, preset} = useAlarmLogSearch();

  // Первый показ — последние сутки. Администратору — по всем проектам, остальным — по одному:
  // без проекта бэкенд ответит 403. Для них ждём список проектов.
  const defaultProject = admin ? null : (currentProjectId ?? projects[0]?.id ?? null);
  const ready = admin || defaultProject != null;
  useEffect(() => {
    if (ready) ensureDefault(defaultProject);
  }, [ready, defaultProject, ensureDefault]);

  const projectName = useMemo(() => {
    const map = new Map(projects.map(p => [p.id, p.name] as const));
    return (id: number | null) => (id == null ? "—" : map.get(id) ?? `#${id}`);
  }, [projects]);

  return (
    <div className={journalPage}>
      <JournalTitle
        title="Журнал аварий"
        description="Сообщения и аварии ПЛК: когда возникли, кто и когда подтвердил, когда сняты"
      />
      <JournalTabs active="alarms" />
      <AlarmLogFilters projects={projects} admin={admin} loading={isLoading} onSearch={search} onPreset={preset} />

      {error && (
        <div className="shrink-0 px-4 py-2 text-sm bg-red-500/10 text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <AlarmLogTable rows={rows} loading={isLoading} projectName={projectName} />
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={isLoading}
                onClick={loadMore}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50"
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Показать ещё
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
