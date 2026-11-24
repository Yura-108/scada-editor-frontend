/** «1 значение» / «2 значения» / «5 значений» — для заголовка подтверждения. */
export const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** Число со словом в нужной форме: `countOf(344, "устройство", "устройства", "устройств")` → «344 устройства». */
export const countOf = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;
