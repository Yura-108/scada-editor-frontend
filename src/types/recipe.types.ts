export interface RecipeValueDto {
  /** Имя свойства компонента. Раньше поле называлось `row_name` (строка таблицы). */
  property_name: string;
  value: string;

  /**
   * Снимок строки таблицы, с которой собран набор. Дублирует поля `PropertyCreateDto`
   * и нужен, чтобы файл рецепта на бэкенде читался сам по себе. КЛЮЧОМ НЕ ЯВЛЯЕТСЯ:
   * сопоставление значения со свойством идёт только по `property_name` (по нему же
   * работает миграция при переименовании), а для записи в ПЛК тег и тип значения
   * берутся из живого свойства компонента — см. `ResolvedRecipeValueDto`.
   *
   * Поля необязательные: рецепты, созданные до их появления, приезжают без них.
   */
  /** Номер строки в таблице (0-based), он же порядок отображения. */
  position?: number | null;
  /** Описание тега из базы каналов (колонка «Описание»). */
  description?: string | null;
  /** Полный путь тега; null/пусто — локальная строка. */
  tag_id?: string | null;
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
  /** Строка, как и `component_id`: бэкенд отдаёт слаг вида `8891-тестовый-рецепт`, Number(...) даст NaN. */
  id: string;
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
  recipe_id: string;
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
  recipeId: string;
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
