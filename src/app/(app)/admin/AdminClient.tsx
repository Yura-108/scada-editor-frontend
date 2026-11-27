'use client';

import React, { useState } from 'react';
import { GitBranch, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { Tabs, type TabItem } from '@/shared/ui/Tabs';
import { PageFrame } from '@/shared/ui/page/PageFrame';
import { PageHeader } from '@/shared/ui/page/PageHeader';
import type { SectionHelp } from '@/shared/ui/page/PageHelp';
import { BranchesTab, resyncAccess, UsersTab } from '@/modules/admin';

type Tab = 'users' | 'branches';

const TABS: TabItem<Tab>[] = [
  { value: 'users', label: 'Пользователи', icon: Users },
  { value: 'branches', label: 'Ветки каталога', icon: GitBranch },
];

const ADMIN_HELP = {
  users: {
    title: 'Администрирование — пользователи',
    body: (
      <p>
        Здесь создают учётные записи и назначают права. Откройте пользователя, чтобы проверить его
        доступ к проектам.
      </p>
    ),
    more: (
      <ul>
        <li>
          Права разделяют просмотр, управление и редактирование. Выдавайте доступ по задачам
          пользователя.
        </li>
        <li>
          Если сохранённые права не применились, кнопка «Обновить права на сервисах» отправит их
          повторно.
        </li>
      </ul>
    ),
  },
  branches: {
    title: 'Администрирование — ветки каталога',
    body: (
      <p>
        Ветки определяют, какие узлы базы каналов доступны пользователям проекта. Выберите проект и
        отметьте нужные узлы в дереве.
      </p>
    ),
    more: (
      <p>
        Нажмите «Сохранить ветки». Просмотр или правка узлов зависят от прав пользователя в проекте.
        Проверить их можно на вкладке «Пользователи».
      </p>
    ),
  },
} satisfies Record<Tab, SectionHelp>;

/**
 * Администрирование (только админ): пользователи, их права в проектах, ветки каталога
 * проектов и перепубликация прав. Регистрации нет — пользователей заводит администратор.
 */
export default function AdminClient() {
  const [tab, setTab] = useState<Tab>('users');
  const [resyncing, setResyncing] = useState(false);

  const handleResync = async () => {
    setResyncing(true);
    try {
      await resyncAccess();
      toast.success('Права перепубликованы на сервисах');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResyncing(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Администрирование"
        help={ADMIN_HELP[tab]}
        icon={ShieldCheck}
        alwaysShowTitle
        actions={
          <Button
            size="sm"
            onClick={() => void handleResync()}
            disabled={resyncing}
            title="Перепубликовать права из базы auth на все сервисы — если права где-то не применились"
          >
            {resyncing ? <Spinner /> : <RefreshCw size={14} />}
            Обновить права на сервисах
          </Button>
        }
      >
        <Tabs
          aria-label="Разделы администрирования"
          value={tab}
          onValueChange={setTab}
          items={TABS}
        />
      </PageHeader>
      <div className="flex-1 min-h-0">{tab === 'users' ? <UsersTab /> : <BranchesTab />}</div>
    </PageFrame>
  );
}
