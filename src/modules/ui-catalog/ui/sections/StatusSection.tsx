"use client";

import React from "react";
import {AlertTriangle, Check, Info, Inbox, Radio} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {EmptyState} from "@/shared/ui/EmptyState";
import {Spinner} from "@/shared/ui/Spinner";
import type {Tone} from "@/shared/ui/tone";
import {CatalogSection, Demo} from "../CatalogSection";

const TONES: Tone[] = ["neutral", "primary", "success", "warning", "destructive", "info"];

export function StatusSection() {
  return (
    <CatalogSection
      id="status"
      title="Статусы"
      description="Badge — короткий статус (шапки страниц), Banner — плашка с пояснением, Spinner — единственный индикатор загрузки, EmptyState — «здесь пусто» с подсказкой, что делать."
    >
      <Demo label="Badge: тона">
        {TONES.map(t => <Badge key={t} tone={t}>{t}</Badge>)}
      </Demo>
      <Demo label="Badge с иконкой">
        <Badge tone="success" icon={<Radio size={12} />}>Живые данные</Badge>
        <Badge tone="warning" icon={<AlertTriangle size={12} />}>Не сохранено</Badge>
        <Badge icon={<Spinner size={12} />}>Сохранение…</Badge>
      </Demo>
      <Demo label='Banner layout="box" (тона)' className="block space-y-2">
        <Banner layout="box" tone="info" icon={Info} title="Только просмотр.">Правки недоступны — права выдаёт администратор.</Banner>
        <Banner layout="box" tone="warning" icon={AlertTriangle} title="Схема изменилась на сервере." actions={<Button size="sm">Обновить</Button>}>
          Кто-то сохранил новую версию.
        </Banner>
        <Banner layout="box" tone="destructive" icon={AlertTriangle} title="Не удалось сохранить." role="alert">Нет связи с сервером.</Banner>
        <Banner layout="box" tone="success" icon={Check}>Выпуск опубликован.</Banner>
      </Demo>
      <Demo label='Banner layout="bar" и "floating"' className="block space-y-2">
        <div className="overflow-hidden rounded-lg border">
          <Banner layout="bar" tone="info" icon={Info}>Полоса под шапкой раздела.</Banner>
        </div>
        <Banner layout="floating" tone="warning" icon={AlertTriangle} title="Просмотр версии 3">Висит над холстом.</Banner>
      </Demo>
      <Demo label="Spinner">
        <Spinner />
        <Spinner size={20} />
        <Spinner label="Загрузка списка…" />
      </Demo>
      <Demo label='EmptyState size="md" и "sm"' className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EmptyState icon={Inbox} title="Таблиц пока нет" description="Создайте первую кнопкой «+»." action={<Button size="sm" variant="primary">Создать</Button>} />
        <EmptyState size="sm" icon={Inbox} title="Ничего не найдено" />
      </Demo>
    </CatalogSection>
  );
}
