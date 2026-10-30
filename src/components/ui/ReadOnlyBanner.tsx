"use client";

import React from "react";
import {Eye} from "lucide-react";
import {Banner} from "@/shared/ui/Banner";

/**
 * Плашка режима «только просмотр» под панелью раздела. Раньше это была мелкая надпись справа
 * сверху, а поля оставались активными: пользователь правил то, что сохранить не мог.
 * Теперь формы раздела заблокированы, а здесь сказано, почему и к кому идти.
 */
export function ReadOnlyBanner({projectName}: {projectName: string}) {
  return (
    <Banner layout="bar" tone="info" icon={Eye} title="Только просмотр.">
      В проекте «{projectName}» у вас нет права правки — изменения здесь недоступны.
      Права в проектах выдаёт администратор.
    </Banner>
  );
}
