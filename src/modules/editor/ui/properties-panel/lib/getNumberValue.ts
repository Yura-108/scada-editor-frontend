/** Число из значения свойства; нечисловое — `fallback`. */
export const getNumberValue = (rawValue: unknown, fallback = 0) => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};
