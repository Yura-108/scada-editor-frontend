import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const GRID = 20;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const snap = (v: number, ) => Math.round(v / GRID) * GRID;
