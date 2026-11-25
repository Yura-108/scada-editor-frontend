/** Старые схемы могут хранить заливку в color, новые круги используют bg. */
export function circleFill(values: { color?: unknown; bg?: unknown }): string {
  if (typeof values.color === 'string' && values.color) return values.color;
  if (typeof values.bg === 'string' && values.bg) return values.bg;
  return 'rgba(200,200,200,0.5)';
}
