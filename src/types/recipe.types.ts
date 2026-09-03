export interface RecipeValueDto {
  /** Имя свойства компонента. Раньше поле называлось `row_name` (строка таблицы). */
  property_name: string;
  value: string;
}

/** Вид набора значений. Список открытый — бэкенд примет любую строку. */
export type RecipeSetType = "recipe" | "station_params" | string;

export interface RecipeCreateDto {
  name: string;
  /** Не прислан — бэкенд подставит "recipe". */
  type?: RecipeSetType;
  /** Строка, а не число: бэкенд отдаёт и принимает идентификатор компонента строкой. */
  component_id: string;
  values: RecipeValueDto[];
}

export interface RecipeDto extends RecipeCreateDto {
  id: number;
}

/** Элемент значения в ответе /resolved — дополнен value_type/tag_id рантаймом. */
export interface ResolvedRecipeValueDto {
  property_name: string;
  value: string;
  value_type: string;
  /** null — локальная строка (значение уходит в сессию, а не в ПЛК). */
  tag_id: string | null;
}

/** GET /api/editor/recipes/{id}/resolved — объект, не массив. */
export interface ResolvedRecipeDto {
  recipe_id: number;
  component_id: string;
  values: ResolvedRecipeValueDto[];
  /** Имена строк, которых в таблице больше нет (удалили/переименовали в обход PUT /properties/{id}). */
  unmatched_rows: string[];
}

/** GET /api/runtime/sessions/{sessionId}/snapshot?componentId= — текущие значения тегов (только теговые строки).
 *  value: null — сразу после рестарта рантайма значения ещё нет в памяти («нет данных», не 0/пусто). */
export interface SnapshotTagValueDto {
  tagId: string;
  value: string | null;
}

/** POST /api/runtime/recipes/apply — результат записи набора значений. */
export interface RecipeApplyResultDto {
  recipeId: number;
  total: number;
  /** Сколько ушло в ПЛК. */
  sent: number;
  /** Сколько записано в сессию (локальные строки). */
  localApplied: number;
  failed: number;
  /** Имена строк, которые не удалось применить. */
  failedRows: string[];
  /** Имена строк из набора, которых в таблице больше нет. */
  unmatchedRows: string[];
}
