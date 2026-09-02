export interface PropertyCreateRequestDto {
  name: string;
  /**
   * Серверный id владельца. `null` — элемент ещё не сохранён: свойство едет вместе со
   * сценой, и владельца бэкенд узнаёт по месту свойства в дереве, а не по этому полю.
   */
  component_id: number | null;
  property_type: string;
  tag_id: string | null;
  description: string;
  value_type: string;
  default_value: string;
  logging: boolean;
  onChange: string;
  access_level: number;
  OnCanChange: string;
  /** Порядок отображения (только для представления, ключом не является). null — старые записи. */
  position?: number | null;
}

export interface PropertyCreateDto extends PropertyCreateRequestDto {
  /**
   * Серверный id свойства. **Необязательный**: свойство создаётся локально и получает
   * номер только после сохранения сцены — отдельного REST-пути у свойств больше нет.
   * Номера нет и у свойств, приехавших из шаблона палитры (у DTO шаблона id нет ни на
   * одном уровне).
   *
   * Идентичность внутри компонента держится на ИМЕНИ: по нему бэкенд сопоставляет
   * строки, когда номера ещё нет, и по нему же привязывается биндинг
   * (`component_property_name`).
   */
  id?: number;
}



