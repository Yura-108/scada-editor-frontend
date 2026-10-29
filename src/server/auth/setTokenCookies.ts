import { NextResponse } from 'next/server';
import { decodeJwtClaims } from '@/server/auth/protected';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/** Сколько живёт cookie, если срок из токена вычитать не удалось. Совпадает с бэкендом. */
const FALLBACK_MAX_AGE = 60 * 60 * 24;

/** Срок refresh-токена, если бэкенд не прислал `refreshExpiresIn`: 7 суток, как в auth. */
const FALLBACK_REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Пара токенов из ответа входа или обновления (контракт 2026-10-28-auth-sessions-contract.md, §1).
 * `refreshToken` нет — бэкенд старый: ставим только `access_token`, как раньше.
 */
export interface SessionPair {
  token: string;
  refreshToken?: string;
  /** Секунды. */
  refreshExpiresIn?: number;
}

export function parseSessionPair(data: Record<string, unknown>): SessionPair | null {
  const token = data.token ?? data.accessToken;
  if (typeof token !== 'string' || !token) return null;
  return {
    token,
    refreshToken: typeof data.refreshToken === 'string' && data.refreshToken ? data.refreshToken : undefined,
    refreshExpiresIn: typeof data.refreshExpiresIn === 'number' ? data.refreshExpiresIn : undefined,
  };
}

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

interface SessionCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  path: string;
  maxAge: number;
  sameSite: 'lax';
}

/** Куда ставить cookie: `response.cookies` или `cookies()` маршрута. */
export interface CookieTarget {
  set(cookie: SessionCookie): unknown;
}

/**
 * Обе cookie — с одинаковыми атрибутами, иначе выход их не перезапишет. `Path=/` и у
 * `refresh_token`: её читают `proxy.ts` на переходах по страницам и `protectedRoute` на любом `/api/*`.
 */
const cookie = (name: string, value: string, maxAge: number, request: Request): SessionCookie => ({
  name,
  value,
  httpOnly: true,
  secure: isHttpsRequest(request),
  path: '/',
  maxAge,
  sameSite: 'lax',
});

export function setSessionCookies(target: CookieTarget, pair: SessionPair, request: Request) {
  target.set(cookie(ACCESS_COOKIE, pair.token, cookieMaxAge(pair.token), request));
  if (pair.refreshToken) {
    target.set(cookie(REFRESH_COOKIE, pair.refreshToken, pair.refreshExpiresIn ?? FALLBACK_REFRESH_MAX_AGE, request));
  }
}

export function clearSessionCookies(target: CookieTarget, request: Request) {
  target.set(cookie(ACCESS_COOKIE, '', 0, request));
  target.set(cookie(REFRESH_COOKIE, '', 0, request));
}

export function setTokenCookie(pair: SessionPair, request: Request) {
  const response = NextResponse.json({ message: 'Успешно' }, { status: 200 });
  setSessionCookies(response.cookies, pair, request);
  return response;
}
