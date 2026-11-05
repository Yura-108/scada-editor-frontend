import {isAccessDenial} from "./accessErrors";

/**
 * Глобальная реакция на «вас больше нет»: 401 от любого `/api/*` или 403 `USER_DISABLED`
 * → выход и страница входа. Раньше протухший или отозванный токен превращался в россыпь
 * тостов на каждой странице, а пользователь оставался в приложении.
 *
 * Ставится один раз на уровне модуля (а не в эффекте провайдера): эффекты дочерних
 * компонентов срабатывают раньше родительских, и первые запросы страницы прошли бы мимо.
 */

/** Ответ входа 401 — это «неверный пароль», а не повод уводить со страницы. */
const EXEMPT = ["/api/auth/login", "/api/auth/logout"];

/**
 * Почему увели на вход — страница входа объясняет это плашкой (`?reason=`). Без объяснения
 * оператора после «Завершить сеансы» молча выкидывало на форму входа.
 *
 * По 401 фронт не отличит отозванный администратором сеанс от истёкшего, поэтому текст общий.
 */
export type LoginLeaveReason = "session" | "disabled";

export const LOGIN_LEAVE_MESSAGES: Record<LoginLeaveReason, string> = {
  session: "Сеанс завершён — войдите снова.",
  disabled: "Учётная запись отключена администратором.",
};

export const isLoginLeaveReason = (value: string | null): value is LoginLeaveReason =>
  value === "session" || value === "disabled";

let installed = false;
let leaving = false;

const isAppApi = (input: RequestInfo | URL): string | null => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith("/api/")) return null;
    return parsed.pathname;
  } catch {
    return null;
  }
};

const leaveToLogin = async (originalFetch: typeof fetch, reason: LoginLeaveReason) => {
  if (leaving || window.location.pathname.startsWith("/login")) return;
  leaving = true;
  await originalFetch("/api/auth/logout", {method: "POST", credentials: "include"}).catch(() => undefined);
  window.location.replace(`/login?reason=${reason}`);
};

const leaveReason = async (res: Response): Promise<LoginLeaveReason | null> => {
  if (res.status === 401) return "session";
  if (res.status !== 403) return null;
  const body = await res.clone().json().catch(() => null);
  return isAccessDenial(body) && body.reason === "USER_DISABLED" ? "disabled" : null;
};

export const installAuthInterceptor = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    const path = isAppApi(input);
    if (path && !EXEMPT.includes(path) && (res.status === 401 || res.status === 403)) {
      // Не ждём: вызывающий код получает ответ как обычно, уход на /login — следом.
      void leaveReason(res).then(reason => (reason ? leaveToLogin(originalFetch, reason) : undefined));
    }
    return res;
  };
};
