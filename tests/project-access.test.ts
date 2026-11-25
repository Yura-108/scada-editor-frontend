import { describe, expect, it } from 'vitest';
import { canOpenInEditor, grantOf, operateLevelOf } from '@/core/access/grants';
import { errorTextFromJson } from '@/core/access/accessErrors';

describe('Права проекта во фронтенде', () => {
  it('сохраняет право просмотра без редактирования и управления', () => {
    const grant = grantOf(
      { access: { view: true, edit: false, operate: false, level: null } },
      false,
    );

    expect(canOpenInEditor(grant)).toBe(true);
    expect(grant.edit).toBe(false);
    expect(operateLevelOf(grant)).toBe(0);
  });

  it('даёт оператору его уровень, без доступа в редактор', () => {
    const grant = grantOf({ access: { view: false, edit: false, operate: true, level: 4 } }, false);

    expect(canOpenInEditor(grant)).toBe(false);
    expect(operateLevelOf(grant)).toBe(4);
  });

  it('при отсутствующих правах закрывает редактор для обычного пользователя', () => {
    expect(canOpenInEditor(grantOf(null, false))).toBe(false);
  });

  it('показывает требуемый уровень из ответа о запрете действия', () => {
    expect(
      errorTextFromJson(403, { error: 'FORBIDDEN', reason: 'LEVEL_TOO_LOW', requiredLevel: 9 }),
    ).toBe('Нужен уровень доступа 9');
  });
});
