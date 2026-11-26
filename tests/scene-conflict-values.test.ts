import { describe, expect, it } from 'vitest';
import type { DiagramElement } from '@/core/scene';
import { conflictCirclePaths, conflictColumns } from '@/modules/editor/lib/conflictValues';

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

  it('показывает X и Y центра круга с радиусом каждой версии, включая старые схемы', () => {
    const state = (x: number, y: number, radius?: number) =>
      JSON.stringify({ name: 'Работа / ожидание', image: JSON.stringify({ x, y, w: 80, radius }) });
    const context = {
      path: 'Группа / Индикатор / Работа / ожидание',
      circlePaths: new Set(['Группа / Индикатор']),
    };

    const columns = conflictColumns(
      state(360, 380),
      state(340, 350, 40),
      state(370, 370, 50),
      context,
    );

    expect(columns.base).toContainEqual({ text: 'X центра: 400' });
    expect(columns.base).toContainEqual({ text: 'Y центра: 420' });
    expect(columns.yours).toContainEqual({ text: 'X центра: 380' });
    expect(columns.yours).toContainEqual({ text: 'Y центра: 390' });
    expect(columns.theirs).toContainEqual({ text: 'X центра: 420' });
    expect(columns.theirs).toContainEqual({ text: 'Y центра: 420' });
  });

  it('не показывает смещение центра, когда при изменении радиуса центр остался на месте', () => {
    const state = (x: number, radius: number) =>
      JSON.stringify({ name: 'Вид', image: { x, radius } });
    const columns = conflictColumns(state(360, 40), state(350, 50), state(340, 60), {
      path: 'Круг / Вид',
      circlePaths: new Set(['Круг']),
    });

    expect(columns.base).toEqual([{ text: 'Радиус: 40' }]);
    expect(columns.yours).toEqual([{ text: 'Радиус: 50' }]);
    expect(columns.theirs).toEqual([{ text: 'Радиус: 60' }]);
  });

  it('учитывает путь родителей и оставляет совпавшие имена разных фигур неоднозначными', () => {
    const element = (
      key: string,
      label: string,
      type: DiagramElement['type'],
      parentKey: string | null = null,
    ): DiagramElement => ({ key, label, type, parentKey }) as DiagramElement;
    const paths = conflictCirclePaths([
      element('group1', 'Группа 1', 'group'),
      element('group2', 'Группа 2', 'group'),
      element('circle1', 'Индикатор', 'circle', 'group1'),
      element('rect1', 'Индикатор', 'rectangle', 'group2'),
      element('circle2', 'Индикатор', 'circle', 'group2'),
    ]);

    expect([...paths]).toEqual(['Группа 1 / Индикатор']);
  });
});
