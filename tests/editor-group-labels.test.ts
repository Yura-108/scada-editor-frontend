import { describe, expect, it } from 'vitest';
import { bindActiveStateReader } from '@/core/scene';
import { elementDisplayName } from '@/modules/editor/lib/elementNames';
import { groupElements } from '@/modules/editor/model/groupOps/groupElements';
import { buildNewElement } from '@/modules/editor/model/newElement';

describe('имена групп в редакторе', () => {
  it('присваивает новым группам следующий номер на схеме', () => {
    bindActiveStateReader(() => ({}));
    const elements = [
      buildNewElement('circle', 0, 0, undefined),
      buildNewElement('rectangle', 100, 0, undefined),
      buildNewElement('circle', 200, 0, undefined),
      buildNewElement('rectangle', 300, 0, undefined),
    ];
    const [first, second, third, fourth] = elements;

    const firstGroup = groupElements(elements, [first.key, second.key], null)!;
    expect(firstGroup.elements.find((el) => el.key === firstGroup.selectedIds[0])).toMatchObject({
      type: 'group',
      label: 'Группа 1',
    });

    const secondGroup = groupElements(firstGroup.elements, [third.key, fourth.key], null)!;
    expect(secondGroup.elements.find((el) => el.key === secondGroup.selectedIds[0])).toMatchObject({
      type: 'group',
      label: 'Группа 2',
    });
  });

  it('показывает старое автоматическое имя по-русски и сохраняет введённые названия', () => {
    expect(elementDisplayName({ type: 'group', label: 'Group (4)' })).toBe('Группа (4)');
    expect(elementDisplayName({ type: 'group', label: 'Танки нормализации' })).toBe(
      'Танки нормализации',
    );
    expect(elementDisplayName({ type: 'text', label: 'Group (4)' })).toBe('Group (4)');
  });
});
