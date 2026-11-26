import { describe, expect, it } from 'vitest';
import { conflictColumns } from '@/modules/editor/lib/conflictValues';

describe('Значения в конфликте сохранения схемы', () => {
  it('показывает различия геометрии из image состояния', () => {
    const state = (x: number) =>
      JSON.stringify({
        name: 'Нормальное',
        image: JSON.stringify({ x, y: 380, w: 80, h: 80 }),
      });

    expect(conflictColumns(state(360), state(340), state(370))).toEqual({
      base: [{ text: 'Положение X: 360' }],
      yours: [{ text: 'Положение X: 340' }],
      theirs: [{ text: 'Положение X: 370' }],
    });
  });

  it('сравнивает состояния независимо от порядка ключей в image', () => {
    const base = JSON.stringify({ image: '{"x":360,"y":380}' });
    const yours = JSON.stringify({ image: { y: 380, x: 360 } });

    expect(conflictColumns(base, yours, base)).toEqual({ base: [], yours: [], theirs: [] });
  });

  it('обозначает недоступные данные состояния и сохраняет известные координаты', () => {
    const columns = conflictColumns(
      undefined,
      JSON.stringify({ image: '{' }),
      JSON.stringify({ image: '{"x":360}' }),
    );

    expect(columns.base).toEqual([]);
    expect(columns.yours).toContainEqual({ text: 'Вид элемента: данные недоступны' });
    expect(columns.theirs).toContainEqual({ text: 'Положение X: 360' });
  });

  it('сохраняет обычные скалярные значения', () => {
    expect(conflictColumns('340', '360', '370')).toEqual({
      base: [{ text: '340' }],
      yours: [{ text: '360' }],
      theirs: [{ text: '370' }],
    });
  });
});
