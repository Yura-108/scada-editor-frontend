'use client';

import {useEffect} from "react";
import {CircleAlert, Loader2, RefreshCw} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useLogsFilterStore, useLogsSearch} from "@/modules/logs";
import LogsList from "@/components/logs/LogsList";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {journalFilterBar, JournalField, JournalPresets, toLocalInput} from "@/components/journal/journalUi";
import {Input} from "@/shared/ui/field/Input";

const DAY_MS = 24 * 3600_000;

/**
 * Логи базы каналов: кто и что менял в устройствах и параметрах, с отменой.
 * Выглядит и управляется как «Журнал действий» (общие части — `journalUi`): период с подписями,
 * «Показать», быстрые периоды, таблица в рамке. Своё — поиск по пользователю среди загруженного
 * (без запроса) и отмена записи.
 */
export default function LogsPage() {
  const {fromDate, toDate, searchQuery, setFromDate, setToDate, setSearchQuery} = useLogsFilterStore(useShallow(s => ({
    fromDate: s.fromDate, toDate: s.toDate, searchQuery: s.searchQuery,
    setFromDate: s.setFromDate, setToDate: s.setToDate, setSearchQuery: s.setSearchQuery,
  })));
  const {isLoading, error, search} = useLogsSearch();

  // Первый показ — последние сутки, как в журнале действий: раньше страница открывалась пустой
  // и ждала, пока выберут даты.
  useEffect(() => {
    const store = useLogsFilterStore.getState();
    if (store.submitted || store.fromDate) return;
    const now = Date.now();
    store.setFromDate(toLocalInput(now - DAY_MS));
    store.setToDate(toLocalInput(now));
    store.submit();
  }, []);

  const applyPreset = (ms: number) => {
    const now = Date.now();
    setFromDate(toLocalInput(now - ms));
    setToDate(toLocalInput(now));
    search();
  };

  return (
    <PageFrame>
      <PageHeader
        title="Логирование"
        description="Изменения устройств и параметров в базе каналов — с возможностью отмены"
        alwaysShowTitle
      />
      <form className={journalFilterBar} onSubmit={e => { e.preventDefault(); search(); }}>
        <JournalField label="С">
          <Input size="sm" type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </JournalField>
        <JournalField label="По">
          <Input size="sm" type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)} />
        </JournalField>
        <JournalField label="Пользователь">
          <Input
            size="sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="часть имени"
            title="Фильтрует уже загруженные записи, без нового запроса"
          />
        </JournalField>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Показать
        </Button>
        <JournalPresets onPick={applyPreset} />
      </form>

      {error && <Banner layout="bar" tone="destructive" icon={CircleAlert}>{error}</Banner>}

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <LogsList />
        </div>
      </div>
    </PageFrame>
  );
}
