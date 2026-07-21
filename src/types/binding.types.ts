/**
 * Ссылка на свойство ДРУГОГО компонента сцены (или своего же) — расширяет скоуп
 * биндинга помимо собственных свойств-тегов. Имя `varName` становится переменной
 * в коде (как имя свойства-тега), но значение в рантайме приходит не по `tag_id`,
 * а по `propertyId` в `properties[]` UPDATE (записи серверных Java-скриптов).
 *
 * Снимки `componentLabel`/`propertyName`/`valueType` — только для UI; ключ
 * маршрутизации в рантайме — `propertyId` (= серверный `PropertyCreateDto.id`).
 */
export interface PropertyRef {
  /** Имя переменной в коде (по умолчанию = имя свойства; при коллизии — псевдоним). */
  varName: string;
  /** Серверный id свойства-источника → ключ маршрутизации properties[] в рантайме. */
  propertyId: number;
  /** key компонента-источника на сцене (для отображения/переоткрытия модалки). */
  componentKey: string;
  /** Серверный id компонента-источника (стабилен между загрузками сцены). */
  componentId: number | null;
  /** Снимок названия компонента-источника для UI. */
  componentLabel: string;
  /** Снимок имени свойства для UI. */
  propertyName: string;
  /** Снимок типа значения (string/integer/float/boolean/date). */
  valueType?: string;
}

/**
 * Биндинг — JavaScript-скрипт, исполняемый НА КЛИЕНТЕ движком режима монитора
 * (в отличие от `element.scripts` — Java-скриптов, исполняемых на сервере).
 *
 * Скоуп кода: свойства-теги элемента (`properties` с `property_type === "Тег"`)
 * доступны по ИМЕНИ свойства как объекты `{V, RAW}` (`V` — число, если значение
 * парсится, иначе строка). Плюс ссылки на свойства других компонентов сцены
 * (`propertyRefs`, доступны так же по имени переменной). Плюс API движка:
 * `setState("Имя состояния")`, `setProp("color", "#f00")`, `self` (rendered-снимок
 * элемента, только чтение).
 *
 * Пример: `if (LINE1FQT1.V > 100) { setState("Авария") } else { setState("Нормальное") }`
 *
 * Сериализация: биндинг целиком уезжает JSON-строкой в DTO-поле `script`
 * (бэкенд хранит его как опак-строку — контракт не меняется; поэтому `propertyRefs`
 * round-trip'ится без правок контракта).
 */
export interface TagBinding {
  /** Маркер схемы — по нему parseBindings отличает «наши» биндинги от легаси-мусора. */
  v: 1;
  /** createUuid() — клиентский id, живёт внутри JSON. */
  id: string;
  name: string;
  enabled: boolean;
  /** JavaScript-исходник; компилируется один раз на сцену через new Function. */
  code: string;
  /**
   * tag_id-ы, изменение которых запускает биндинг. Не задано — биндинг
   * запускается на любой тег из своего скоупа (свойств-тегов элемента).
   */
  triggers?: string[];
  /**
   * Ссылки на свойства других компонентов сцены. Не задано / пусто —
   * скоуп биндинга состоит только из свойств-тегов самого элемента (легаси).
   */
  propertyRefs?: PropertyRef[];
  /**
   * Прямая привязка «значение элемента ← значение свойства» без кода/имени:
   * `code` сгенерирован автоматически (`setProp("value", <ref>.V)`), UI не
   * показывает редактор кода. Внутри — обычный биндинг (движок не меняется).
   */
  direct?: boolean;
}

/** Формат биндинга в ComponentCreateDto (контракт бэкенда, не менять). */
export type BindingDto = {
  component_property_id: number;
  name: string;
  script: string;
};

/**
 * Обработчик события элемента (onClick/onDoubleClick) — JavaScript, исполняемый
 * НА КЛИЕНТЕ в режиме монитора при клике/двойном клике по элементу.
 *
 * Скоуп: как у биндинга (свойства-теги + `propertyRefs` доступны по имени как
 * `{V, RAW}`), плюс API записи: `setProperty("Имя", значение)` — пишет значение
 * в свойство (по propertyRefs), на него реагируют биндинги других элементов;
 * `setProp("key", v)` / `setState("Имя")` — визуал/состояние самого элемента;
 * `self` — rendered-снимок.
 *
 * Пример: `setProperty("Test", Test.V + 1)` — инкремент свойства объекта.
 */
export interface ElementEventHandler {
  /** JavaScript-исходник обработчика. */
  code: string;
  /** Обработчик включён (по умолчанию true). */
  enabled?: boolean;
  /** Свойства объектов сцены в скоупе (чтение `Имя.V` + запись `setProperty`). */
  propertyRefs?: PropertyRef[];
}

/** События элемента, обрабатываемые на клиенте в режиме монитора. */
export interface ElementEvents {
  onClick?: ElementEventHandler;
  onDoubleClick?: ElementEventHandler;
}

/** Имена поддерживаемых событий. */
export type ElementEventName = keyof ElementEvents;
