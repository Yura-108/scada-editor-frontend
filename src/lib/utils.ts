export const GRID = 20;

export const snap = (v: number, ) => Math.round(v / GRID) * GRID;
