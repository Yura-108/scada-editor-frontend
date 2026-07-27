export interface RecipeValueDto {
  tag_id: string;
  value: string;
}

export interface RecipeCreateDto {
  name: string;
  component_id: number;
  values: RecipeValueDto[];
}

export interface RecipeDto extends RecipeCreateDto {
  id: number;
}

/** GET /api/runtime/sessions/{sessionId}/snapshot?componentId= — текущие значения тегов. */
export interface SnapshotTagValueDto {
  tagId: string;
  value: string;
}

/** POST /api/runtime/recipes/apply — результат записи рецепта в ПЛК. */
export interface RecipeApplyResultDto {
  total: number;
  sent: number;
  failed: number;
  failedTags: string[];
}
