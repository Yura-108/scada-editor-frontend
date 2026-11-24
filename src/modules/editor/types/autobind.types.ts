/**
 * Отчёт автопривязки проекта к базе каналов.
 *
 * Контракт — `docs/contract/2026-09-22-autobind-contract.md`; формы сверены с
 * `AutobindReportDto` бэкенда (коммит `ae8c259`).
 */

/** Сцена, которую автопривязка изменила и которой записала новую версию (`MANUAL`). */
export interface AutobindScene {
  scene_id: number;
  name: string;
  version_no: number;
}

/**
 * Несовпадение. У `not_found` поля `property` НЕТ вовсе (а не `null`): там не найден сам
 * объект — бэкенд отдаёт запись через `@JsonInclude(NON_NULL)`.
 */
export interface AutobindMiss {
  component_id: number;
  name: string;
  property?: string;
  scene: string;
}

export interface AutobindReport {
  channel_root: string;
  /**
   * Свойств, для которых тег в базе нашёлся, — включая те, у кого он и так был правильным.
   * Повторная автопривязка даёт тот же `bound` при `changed: 0`.
   */
  bound: number;
  /** Из них те, у кого тег действительно поменялся. */
  changed: number;
  /** Пусто, если ничего не изменилось: версия пишется только изменённой сцене. */
  scenes: AutobindScene[];
  /**
   * Объект не найден ОДНОЗНАЧНО: его нет в базе либо старое имя («Имя в ПЛК») указывает
   * на два разных объекта и потому выброшено из индекса. Теги этих компонентов не тронуты.
   */
  not_found: AutobindMiss[];
  /** Объект найден, но поля с именем свойства у него нет. */
  missing_fields: AutobindMiss[];
  /** Проект в эксплуатации — runtime увидит новые теги только после повторного подъёма. */
  in_operation: boolean;
}
