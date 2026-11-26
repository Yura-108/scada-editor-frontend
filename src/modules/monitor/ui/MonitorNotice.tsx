import React from 'react';
import { CircleAlert, Package } from 'lucide-react';
import { Banner } from '@/shared/ui/Banner';

/**
 * Выпуск не отдаётся (проект не в эксплуатации): схем нет вовсе, и пустой холст
 * выглядел бы поломкой.
 */
export function NoReleaseNotice({
  prodVersionNo,
  inOperation,
}: {
  prodVersionNo: number | null | undefined;
  inOperation: boolean | undefined;
}) {
  const message =
    prodVersionNo === null
      ? 'У проекта ещё нет выпуска для показа. Схемы появятся после выпуска в редакторе и ввода проекта в эксплуатацию.'
      : inOperation === false
        ? 'Проект не введён в эксплуатацию. Схемы появятся после его ввода в эксплуатацию.'
        : 'Схемы проекта сейчас недоступны. Обратитесь к администратору.';
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Banner tone="warning" icon={Package} className="max-w-md">
        {message}
      </Banner>
    </div>
  );
}

/**
 * Состояние «проект выключен» должно быть видимым, а не выглядеть поломкой:
 * текст причины приходит с бэкенда и называет её прямо.
 */
export function RejectedNotice({ detail }: { detail: string | null | undefined }) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Banner
        tone="destructive"
        icon={CircleAlert}
        title="Монитор не подключён"
        className="max-w-md"
      >
        <p>{detail || 'Рантайм отклонил подключение.'}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Проект исполняется, только когда он введён в эксплуатацию — включить его можно в списке
          проектов, после этого выберите схему заново. Если причина в правах доступа, их выдаёт
          администратор.
        </p>
      </Banner>
    </div>
  );
}
