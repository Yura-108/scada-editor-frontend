export interface PropertyCreateDto {
  id: number;
  component_id: number;
  property_type: string | null;
  tag_id: string;
  description: string | null;
  value_type: string | null;
  default_value: string | null;
  logging: boolean;
  onChange: string | null;
}



