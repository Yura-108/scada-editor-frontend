/**
 * Стиль пунктира: "5 5" / "10 5 2 5" → [5,5] / [10,5,2,5]; пусто → сплошная линия.
 *
 * Живёт отдельным модулем, потому что читают его и `ShapeElement` (линия,
 * прямоугольник, рамки техобъектов из импорта CONTUR), и `ArcShapeElement`:
 * импортировать из первого во второй нельзя — там уже есть обратная связь по
 * диспетчеру типов, вышел бы цикл.
 */
export const parseDashArray = (raw: string | undefined): number[] | undefined => {
  const parts = (raw || "").trim().split(/\s+/).map(Number);
  const nums = parts.filter((n) => Number.isFinite(n) && n >= 0);
  return nums.length ? nums : undefined;
};

/** Штрих «пунктир» по умолчанию — там, где источник говорит только «пунктир», без рисунка
 *  (рамки техобъектов CONTUR, `dashed: true` в плане устройств). */
export const DEFAULT_DASH = "6 4";
