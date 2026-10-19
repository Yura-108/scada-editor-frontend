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

/**
 * Запрос пришёл по https: напрямую или через обратный прокси, который выставил x-forwarded-proto.
 *
 * От этого, а не от `NODE_ENV`, зависит флаг `Secure` у cookie: стенд и Docker-пакет — это
 * production-сборка по http, и cookie с `Secure` браузер там примет только с `localhost`, а по IP
 * молча отбросит (контракт 2026-10-19-auth-cookie-secure-contract.md). За TLS-прокси Next сам видит
 * http, поэтому сначала заголовок; прокси могут дописывать значения через запятую — берём первое.
 */
export function isHttpsRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  return new URL(request.url).protocol === 'https:';
}

export function setTokenCookie(token: string, request: Request) {
  const response = NextResponse.json({ message: 'Успешно' }, { status: 200 });

  response.cookies.set({
    name: 'access_token',
    value: token,
    httpOnly: true,
    secure: isHttpsRequest(request),
    path: '/',
    maxAge: cookieMaxAge(token),
    sameSite: 'lax',
  });

  return response;
}
