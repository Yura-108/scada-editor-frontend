import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { PageHelp, type SectionHelp } from './PageHelp';

/**
 * Шапка раздела — одна строка 48px: название, затем выбор проекта и вкладки (`children`),
 * справа действия (`actions`). Строка не переносится. На узком окне вбок прокручивается только
 * середина, а действия закреплены у правого края: раньше прокручивалась вся строка, и
 * «Сохранить» уезжала за край. По умолчанию элементы середины сохраняют свою ширину.
 * `shrinkContent` разрешает сжимать элементы с заданной минимальной шириной.
 * Название раздела на узком окне прячется:
 * оно есть в шапке приложения и во вкладке браузера.
 * `alwaysShowTitle` — для раздела, где в строке почти ничего нет (администрирование).
 * `className` — для строки с содержимым (например, свой `gap`).
 * `actions` также подходит для статусов, которые должны оставаться на виду.
 * `help` добавляет кнопку «?» у правого края шапки.
 */
export function PageHeader({
  title,
  icon: Icon,
  description,
  actions,
  help,
  alwaysShowTitle = false,
  shrinkContent = false,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Пояснение к разделу — приглушённо после названия, только на широком окне. */
  description?: React.ReactNode;
  actions?: React.ReactNode;
  help?: SectionHelp;
  alwaysShowTitle?: boolean;
  shrinkContent?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const hiddenOnSmall = !alwaysShowTitle && 'max-xl:hidden';

  return (
    <div className="flex h-(--page-header-h) shrink-0 items-center gap-3 border-b bg-card px-4">
      <div
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap',
          !shrinkContent && '[&>*]:shrink-0',
          className,
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-baseline gap-3',
            !alwaysShowTitle && 'max-xl:contents',
          )}
        >
          {Icon && (
            <Icon
              size={16}
              aria-hidden
              className={cn(hiddenOnSmall, 'shrink-0 self-center text-primary')}
            />
          )}
          <h1
            className={cn(
              'text-sm font-semibold text-foreground',
              !alwaysShowTitle && 'max-xl:sr-only',
            )}
          >
            {title}
          </h1>
          {description && (
            <span className={cn(hiddenOnSmall, 'text-xs text-muted-foreground')}>
              {description}
            </span>
          )}
        </div>
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">{actions}</div>
      )}
      {help && <PageHelp help={help} />}
    </div>
  );
}
