/** У старых кругов радиус мог отсутствовать в данных состояния. */
export const circleRadius = (radius?: number, width = 0): number => radius || width / 2 || 40;
