import { NextResponse } from 'next/server';
import { decodeJwtClaims } from '@/lib/protected';

/** Сколько живёт cookie, если срок из токена вычитать не удалось. Совпадает с бэкендом. */
const FALLBACK_MAX_AGE = 60 * 60 * 24;

/**
 * Срок жизни cookie — остаток жизни самого токена (клейм `exp`, секунды с эпохи).
 *
 * Берём из токена, а не константой: раньше здесь стоял жёсткий час, и когда бэкенд
 * поднял срок до суток, cookie продолжала протухать через час — пользователя
 * выкидывало при живом токене. Считать от `exp` значит, что расходиться больше нечему.
 *
 * `exp` нет или он уже в прошлом — берём запасное значение: пусть решает бэкенд,
 * отдав 401, чем мы сами не поставим cookie вовсе.
 */
function cookieMaxAge(token: string): number {
  const exp = decodeJwtClaims(token)?.exp;
  if (typeof exp !== 'number') return FALLBACK_MAX_AGE;

  const remaining = Math.floor(exp - Date.now() / 1000);
  return remaining > 0 ? remaining : FALLBACK_MAX_AGE;
}

export function setTokenCookie(token: string) {
  const response = NextResponse.json({ message: 'Успешно' }, { status: 200 });

  response.cookies.set({
    name: 'access_token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookieMaxAge(token),
    sameSite: 'lax',
  });

  return response;
}
