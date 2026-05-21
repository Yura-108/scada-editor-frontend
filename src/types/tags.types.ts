export interface PropertyCreateRequestDto {
  component_id: number;
  property_type: string;
  tag_id: string;
  description: string;
  value_type: string;
  default_value: string;
  logging: boolean;
  onChange: string;
}

export interface PropertyCreateDto extends PropertyCreateRequestDto {
  id: number;
}



