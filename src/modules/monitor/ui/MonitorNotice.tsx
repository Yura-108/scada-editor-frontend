import React from "react";
import {CircleAlert, Package} from "lucide-react";
import {Banner} from "@/shared/ui/Banner";

/**
 * Выпуск не отдаётся (проект не в эксплуатации): схем нет вовсе, и пустой холст
 * выглядел бы поломкой.
 */
export function NoReleaseNotice({message}: {message: string}) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Banner tone="warning" icon={Package} title="Нет выпуска для показа" className="max-w-md">
        <p>{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Монитор показывает prod-выпуск проекта, а его исполняет только проект в
          эксплуатации. Ввести проект и выбрать выпуск можно в редакторе.
        </p>
      </Banner>
    </div>
  );
}

/**
 * Состояние «проект выключен» должно быть видимым, а не выглядеть поломкой:
 * текст причины приходит с бэкенда и называет её прямо.
 */
export function RejectedNotice({detail}: {detail: string | null | undefined}) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Banner tone="destructive" icon={CircleAlert} title="Монитор не подключён" className="max-w-md">
        <p>{detail || "Рантайм отклонил подключение."}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Проект исполняется, только когда он введён в эксплуатацию — включить его можно
          в списке проектов, после этого выберите схему заново. Если причина в правах
          доступа, их выдаёт администратор.
        </p>
      </Banner>
    </div>
  );
}
