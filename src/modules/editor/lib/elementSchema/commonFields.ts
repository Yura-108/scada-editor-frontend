import {PropertySchema} from "@/core/scene";

/**
 * Слой отрисовки — есть у КАЖДОГО элемента (поле `zIndex` объявлено на
 * `BaseCanvasElement`). Сортировка идёт среди соседей одного контейнера, как в CSS.
 *
 * Экспортируется отдельно, потому что мультивыделение собирает схему только из
 * `elementPropertyMap` и `basePropertySchema` не подмешивает.
 */
export const Z_INDEX_FIELD: PropertySchema = {
  key: "zIndex",
  label: "Слой (z-index)",
  type: "number",
  min: -999,
  max: 999,
  step: 1,
  defaultValue: 0,
};

export const basePropertySchema: PropertySchema[] = [
  {
    key: "label",
    label: "Название",
    type: "text",
  },
  Z_INDEX_FIELD,
];

/**
 * Стиль обводки — один и тот же пункт у всех фигур с контуром.
 *
 * Значение уходит в `strokeDasharray` и разбирается общим `parseDashArray`
 * (`core/scene/element/dashArray.ts`), который читают все ветки рендера.
 */
export const DASH_FIELD: PropertySchema = {
  key: "strokeDasharray",
  label: "Стиль (пунктир)",
  type: "select",
  options: [
    {label: "Сплошная", value: ""},
    {label: "Пунктир", value: "5 5"},
    {label: "Штрих-пунктир", value: "10 5 2 5"},
  ],
  defaultValue: "",
};
