import { callAuth } from '@/server/auth/auth';
import { decodeJwtClaims } from '@/server/auth/jwtClaims';
import { parseSessionPair, type SessionPair } from '@/server/auth/setTokenCookies';

/**
 * Обновление пары токенов — только здесь, на сервере BFF: браузер про refresh-токен не знает
 * (контракт 2026-10-28-auth-sessions-contract.md, §2). Зовут `protectedRoute` и `proxy.ts`.
 */

/** Обновлять заранее: до `exp` осталось меньше минуты — запрос может не успеть. */
const REFRESH_AHEAD_S = 60;

/**
 * Сколько держать результат ротации. Предъявить погашенный refresh-токен — для бэкенда признак
 * кражи (гаснет вся цепочка), поэтому запоздавший запрос со старой cookie получает ту же новую
 * пару отсюда, а не идёт на бэкенд. У бэкенда своё окно — 30 с; наше короче.
 */
const SHARED_RESULT_MS = 20_000;

/** `null` — refresh-токен больше не годен (401): входить заново. */
type Rotation = SessionPair | null;

const rotations = new Map<string, { promise: Promise<Rotation>; expiresAt: number }>();

export function needsRefresh(access: string | undefined): boolean {
  if (!access) return true;
  const exp = decodeJwtClaims(access)?.exp;
  // Срока в токене нет — обновлять не по чему, решает бэкенд своим 401.
  if (typeof exp !== 'number') return false;
  return exp - Date.now() / 1000 < REFRESH_AHEAD_S;
}

/** Сбой связи или странный ответ бросает: из‑за моргнувшего gateway вход стирать нельзя. */
async function rotate(refreshToken: string): Promise<Rotation> {
  const { ok, status, data } = await callAuth('/api/auth/refresh', { refreshToken });
  if (status === 401) return null;
  if (!ok) throw new Error(`POST /api/auth/refresh → ${status}`);
  const pair = parseSessionPair(data);
  if (!pair) throw new Error('POST /api/auth/refresh: в ответе нет токена');
  return pair;
}

/** Одна ротация на один refresh-токен: параллельные запросы с ним ждут общий промис. */
export function refreshSession(refreshToken: string): Promise<Rotation> {
  const now = Date.now();
  for (const [key, entry] of rotations) {
    if (entry.expiresAt <= now) rotations.delete(key);
  }

  const shared = rotations.get(refreshToken);
  if (shared) return shared.promise;

  const entry = { promise: rotate(refreshToken), expiresAt: Infinity };
  rotations.set(refreshToken, entry);
  entry.promise.then(
    () => { entry.expiresAt = Date.now() + SHARED_RESULT_MS; },
    // Ошибку не держим: следующий запрос попробует снова.
    () => { rotations.delete(refreshToken); },
  );
  return entry.promise;
}

export type SessionState =
  /** Текущий access-токен годен. */
  | { kind: 'valid'; token: string }
  /** Пара обновлена — cookie выставить на ответ. */
  | { kind: 'refreshed'; pair: SessionPair }
  /** Войти нечем: обе cookie стереть, на вход. */
  | { kind: 'dead' }
  /** auth не ответил; `token` — прежний access, если он ещё есть. */
  | { kind: 'unavailable'; token?: string };

export async function resolveSession(access: string | undefined, refresh: string | undefined): Promise<SessionState> {
  if (access && !needsRefresh(access)) return { kind: 'valid', token: access };
  // Старый вход без refresh-токена: доживает свой access, как раньше.
  if (!refresh) return access ? { kind: 'valid', token: access } : { kind: 'dead' };

  try {
    const pair = await refreshSession(refresh);
    return pair ? { kind: 'refreshed', pair } : { kind: 'dead' };
  } catch (err) {
    console.warn('[auth] не удалось обновить токен:', err);
    return { kind: 'unavailable', token: access };
  }
}
