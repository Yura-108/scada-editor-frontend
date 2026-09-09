import type {DiagramElement, TableCellData} from "@/types/editorElement.type";
import type {Recipe} from "@/types/recipe.types";
import {cellId} from "@/lib/editor/tableCells";
import {headerHeight} from "@/lib/editor/tableLayout";
import {snap, GRID} from "@/lib/utils";

/**
 * Таблица-визуализация манифеста рецепта.
 *
 * Направление связи одностороннее: таблица строится ИЗ рецепта и только показывает его.
 * Источник истины — рецепт на бэкенде; правка ячеек ничего не меняет и обратно не едет.
 * (В прежней модели было наоборот — таблица хранила уставки, а сохранение сцены
 * переписывало json. Уставок в рецепте больше нет: значения живут в действиях шагов.)
 *
 * Ячейки — свободный текст, без привязок к свойствам: показывать нечего, кроме того,
 * что уже лежит в манифесте.
 *
 * Модуль чистый (ни Konva, ни стора) — как соседние `tableCells.ts`/`tableLayout.ts`.
 */

const FONT_SIZE = 12;
const TABLE_WIDTH = 720;
/** Веса колонок; нормируются к ширине (см. tableLayout.ts). */
const COL_WEIGHTS = [40, 180, 300, 200];
const COLUMN_TITLES = ["№", "Имя", "Тег", "Описание"];

export interface RecipeTableInput {
  recipe: Recipe;
  key: string;
  stateId: string;
  sceneId: number | string | null | undefined;
  /** Центр таблицы в МИРОВЫХ координатах. */
  centerX: number;
  centerY: number;
}

export function buildRecipeTableElement(input: RecipeTableInput): DiagramElement {
  const {recipe, key, stateId, sceneId, centerX, centerY} = input;
  const tags = recipe.tags ?? [];

  const headerH = headerHeight(true, FONT_SIZE);
  // Строк на одну больше числа тегов: нулевая — названия колонок.
  const rowCount = tags.length + 1;
  const w = snap(TABLE_WIDTH);
  const h = snap(headerH + rowCount * GRID);

  const cells: Record<string, TableCellData> = {};
  COLUMN_TITLES.forEach((text, col) => {
    cells[cellId(0, col)] = {value: text};
  });

  tags.forEach((tag, index) => {
    const r = index + 1;
    cells[cellId(r, 0)] = {value: String(r)};
    cells[cellId(r, 1)] = {value: tag.name};
    cells[cellId(r, 2)] = {value: tag.tag};
    cells[cellId(r, 3)] = {value: tag.description ?? ""};
  });

  return {
    id: null, key, type: "table", composition: [],
    x: snap(centerX - w / 2), y: snap(centerY - h / 2), w, h,
    rows: rowCount, cols: COLUMN_TITLES.length,
    showHeader: true, headerText: recipe.name, alternateRow: false,
    backgroundColor: "transparent", headerColor: "transparent",
    strokeColor: "#000000", textColor: "#000000", fontSize: FONT_SIZE,
    alternateColor: "#f1f5f9",
    colWidths: [...COL_WEIGHTS],
    cells,
    label: recipe.name,
    bg: "transparent",
    /**
     * Пометка «эта таблица показывает такой-то рецепт» — по ней таблица находится для
     * пересборки. Полю не нужен ни рендер, ни контракт: неизвестные поля элемента
     * запекаются в `states[].image` и возвращаются оттуда при загрузке (тем же путём
     * ездят `tech_object` и `contur_frame` у импорта CONTUR).
     */
    recipe_id: recipe.id,
    parentId: (typeof sceneId === "number" ? sceneId : null),
    parentKey: sceneId != null ? String(sceneId) : null,
    children: [], scripts: [], bindings: [], properties: [],
    states: [{id: stateId, name: "Нормальное", overrides: {}, isDefault: true}],
  } as DiagramElement;
}

/** `recipe_id` элемента, если это таблица-визуализация рецепта. */
export function recipeIdOf(el: DiagramElement): string | null {
  const raw = (el as unknown as {recipe_id?: unknown}).recipe_id;
  return typeof raw === "string" && raw ? raw : null;
}
