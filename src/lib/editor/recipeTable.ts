import type {DiagramElement, TableCellData} from "@/types/editorElement.type";
import type {TagBinding} from "@/types/binding.types";
import type {PropertyCreateDto} from "@/types/tags.types";
import type {RecipeTableRow} from "@/lib/editor/tagMeta";
import {cellId} from "@/lib/editor/tableCells";
import {headerHeight} from "@/lib/editor/tableLayout";
import {snap, GRID} from "@/lib/utils";

/**
 * Сборка таблицы-рецепта из выбранных тегов.
 *
 * Раскладку колонок в таблице задают ПРИВЯЗКИ ЯЧЕЕК, а не рендер (см. tableBindings.ts),
 * поэтому все четыре колонки описаны здесь явно:
 *
 *  - `№` (0) и `Значение` (3) — БЕЗ привязки: `resolveCellText` для непривязанной ячейки
 *    возвращает свободный текст из `cells`, что и даёт нумерацию и редактируемые
 *    пользователем нули (значения уставок он проставляет сам после создания);
 *  - `Описание` (1) и `Имя свойства` (2) привязаны к статическим полям СВОЕГО свойства,
 *    так что правка описания или переименование свойства сразу видны в таблице.
 *
 * Строка 0 — названия колонок: у элемента `table` заголовок (`headerText`) один на всю
 * ширину, отдельного понятия «шапка колонок» в модели нет, и подписать колонки можно
 * только обычной строкой.
 *
 * Модуль чистый (ни Konva, ни стора) — как соседние `tableCells.ts`/`tableLayout.ts`:
 * это позволяет проверять round-trip `buildComponentTree` → `transformElements` без UI.
 */

/** Кегль таблицы-рецепта; от него же считается высота шапки. */
const FONT_SIZE = 12;

/** Ширина таблицы и веса колонок (нормируются к ширине, см. tableLayout.ts). */
const TABLE_WIDTH = 640;
const COL_WEIGHTS = [40, 260, 180, 120];

/** Подписи колонок в нулевой строке. */
const COLUMN_TITLES = ["№", "Описание", "Имя свойства", "Значение"];

/** Заготовка уставки: пользователь проставит своё значение прямо в ячейке. */
const INITIAL_VALUE = "0";

export interface RecipeTableInput {
  rows: RecipeTableRow[];
  /** Заголовок таблицы; он же имя рецепта и `label` элемента. */
  title: string;
  key: string;
  stateId: string;
  /** Ключи привязок ячеек — снаружи, чтобы сборка оставалась детерминированной. */
  bindingIds: string[];
  sceneId: number | string | null | undefined;
  /** Центр таблицы в МИРОВЫХ координатах. */
  centerX: number;
  centerY: number;
}

/** Сколько ключей привязок нужно на `rows.length` строк (по одной на колонку 1 и 2). */
export const bindingIdCount = (rowCount: number): number => rowCount * 2;

export function buildRecipeTableElement(input: RecipeTableInput): DiagramElement {
  const {rows, title, key, stateId, bindingIds, sceneId, centerX, centerY} = input;

  const headerH = headerHeight(true, FONT_SIZE);
  // Строк на одну больше числа тегов: нулевая — названия колонок.
  const rowCount = rows.length + 1;
  const w = snap(TABLE_WIDTH);
  const h = snap(headerH + rowCount * GRID);

  const cells: Record<string, TableCellData> = {};
  COLUMN_TITLES.forEach((text, col) => {
    cells[cellId(0, col)] = {value: text};
  });

  const properties: PropertyCreateDto[] = [];
  const bindings: TagBinding[] = [];

  rows.forEach((row, index) => {
    const r = index + 1;
    cells[cellId(r, 0)] = {value: String(r)};
    cells[cellId(r, 3)] = {value: INITIAL_VALUE};

    properties.push({
      name: row.name,
      // Владельца бэкенд узнаёт по месту свойства в дереве сцены: элемента на сервере
      // ещё нет, и собственного номера у него не будет до первого сохранения.
      component_id: null,
      property_type: "Тег",
      tag_id: row.tagId,
      description: row.description,
      value_type: row.valueType,
      default_value: INITIAL_VALUE,
      logging: false,
      onChange: "",
      access_level: 0,
      OnCanChange: "",
      position: index,
    });

    // Свойство адресуется ИМЕНЕМ — так же, как в bindCell панели свойств.
    ([[1, "description"], [2, "name"]] as const).forEach(([col, field], i) => {
      bindings.push({
        v: 1,
        id: bindingIds[index * 2 + i],
        name: row.name,
        enabled: true,
        code: "",
        cell: {row: r, col, propertyName: row.name, field},
      });
    });
  });

  return {
    id: null, key, type: "table", composition: [],
    x: snap(centerX - w / 2), y: snap(centerY - h / 2), w, h,
    rows: rowCount, cols: COLUMN_TITLES.length,
    showHeader: true, headerText: title, alternateRow: false,
    backgroundColor: "transparent", headerColor: "transparent",
    strokeColor: "#000000", textColor: "#000000", fontSize: FONT_SIZE,
    alternateColor: "#f1f5f9",
    colWidths: [...COL_WEIGHTS],
    cells,
    label: title,
    bg: "transparent",
    parentId: (typeof sceneId === "number" ? sceneId : null),
    parentKey: sceneId != null ? String(sceneId) : null,
    children: [], scripts: [], bindings, properties,
    states: [{id: stateId, name: "Нормальное", overrides: {}, isDefault: true}],
  } as DiagramElement;
}
