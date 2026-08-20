export interface PropertyCreateRequestDto {
  name: string;
  component_id: number;
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
  id: number;
}



