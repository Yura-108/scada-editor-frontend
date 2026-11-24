/**
 * Проверка нового пароля — общая для смены своего пароля (шапка) и админки (создание
 * пользователя, сброс пароля). Те же пределы, что проверяет auth (`ChangePasswordDto`).
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

export const passwordProblem = (password: string): string | null =>
  password.length < PASSWORD_MIN ? `Пароль — не короче ${PASSWORD_MIN} символов`
    : password.length > PASSWORD_MAX ? `Пароль — не длиннее ${PASSWORD_MAX} символов`
      : null;
