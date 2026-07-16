/**
 * Биндинг — JavaScript-скрипт, исполняемый НА КЛИЕНТЕ движком режима монитора
 * (в отличие от `element.scripts` — Java-скриптов, исполняемых на сервере).
 *
 * Скоуп кода: свойства-теги элемента (`properties` с `property_type === "Тег"`)
 * доступны по ИМЕНИ свойства как объекты `{V, RAW}` (`V` — число, если значение
 * парсится, иначе строка). Плюс API движка: `setState("Имя состояния")`,
 * `setProp("color", "#f00")`, `self` (rendered-снимок элемента, только чтение).
 *
 * Пример: `if (LINE1FQT1.V > 100) { setState("Авария") } else { setState("Нормальное") }`
 *
 * Сериализация: биндинг целиком уезжает JSON-строкой в DTO-поле `script`
 * (бэкенд хранит его как опак-строку — контракт не меняется).
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
}

/** Формат биндинга в ComponentCreateDto (контракт бэкенда, не менять). */
export type BindingDto = {
  component_property_id: number;
  name: string;
  script: string;
};
