const AUTH_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Одноразовый билет на 30 секунд для WebSocket монитора (`?ticket=`), вместо полного JWT в
 * query: query оседает в журналах прокси (контракт 2026-10-28-auth-sessions-contract.md, §4).
 * Новый — на каждое подключение. `null` — билет взять не удалось.
 */
export async function fetchWsTicket(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${AUTH_BACKEND_URL}/api/auth/ws-ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.warn(`[auth] POST /api/auth/ws-ticket → ${response.status}`);
      return null;
    }
    const data = await response.json().catch(() => null);
    return typeof data?.ticket === 'string' && data.ticket ? data.ticket : null;
  } catch (err) {
    console.warn('[auth] не удалось взять билет WebSocket:', err);
    return null;
  }
}
