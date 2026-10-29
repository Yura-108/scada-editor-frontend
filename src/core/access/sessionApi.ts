/**
 * Запросы сеанса пользователя к BFF. Сами токены браузер не видит (httpOnly-cookie):
 * обновляет и гасит их сервер BFF (контракт 2026-10-28-auth-sessions-contract.md).
 */

/**
 * Освежить cookie `access_token`, если она истекла или вот-вот истечёт. Нужно перед подключением
 * сокетов, которые идут в gateway мимо BFF и несут cookie сами (STOMP редактора).
 * 401 — вход кончился: на страницу входа уведёт `authInterceptor`.
 */
export const refreshSessionCookie = async (): Promise<void> => {
  await fetch("/api/auth/refresh", {method: "POST", credentials: "include"});
};
