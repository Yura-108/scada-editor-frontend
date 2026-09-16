/**
 * Шаблоны задач автоматизации — палитра заготовок, общая для всех проектов.
 * Контракт `docs/contract/2026-09-16-automation-task-templates-contract.md`,
 * сверено с кодом бэкенда (коммит f006791, 16.09.2026).
 */

import type {AutomationValueType} from "@/types/automation.types";

export interface AutomationTemplateIo {
  alias: string;
  /** Пример пути тега — подсказка инженеру, НЕ привязка: бэкенд её не проверяет. */
  example_tag?: string | null;
  value_type: AutomationValueType;
}

/**
 * Отличия от задачи в наборе: нет `enabled` и `project_id`, а у входов и выходов
 * вместо `tag` — `example_tag`. Лишние поля бэкенд молча игнорирует, поэтому
 * положить задачу «как есть» нельзя — перекладываем явно (`automationTemplates.ts`).
 */
export interface AutomationTaskTemplate {
  /** Есть у сохранённого шаблона; в теле POST не нужен, PUT берёт id из пути. */
  id?: number;
  name: string;
  /** Пустая строка приедет обратно как null — бэкенд её нормализует. */
  category?: string | null;
  description?: string | null;
  period_ms: number;
  /**
   * Не прислали — бэкенд подставит 100, но проверит всё равно: диапазон
   * `1 … period_ms / 2`. При периоде меньше 200 мс умолчание не проходит проверку.
   */
  timeout_ms?: number;
  stale_after_ms: number;
  run_on_stale: boolean;
  inputs: AutomationTemplateIo[];
  outputs: AutomationTemplateIo[];
  /** Имена переменных проекта — подсказка: переменных шаблон не создаёт и их не проверяют. */
  writes_variables: string[];
  script: string;
}
