import {isAccessDenial} from "@/lib/access/accessErrors";

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

const leaveToLogin = async (originalFetch: typeof fetch) => {
  if (leaving || window.location.pathname.startsWith("/login")) return;
  leaving = true;
  await originalFetch("/api/auth/logout", {method: "POST", credentials: "include"}).catch(() => undefined);
  window.location.replace("/login");
};

const shouldLeave = async (res: Response): Promise<boolean> => {
  if (res.status === 401) return true;
  if (res.status !== 403) return false;
  const body = await res.clone().json().catch(() => null);
  return isAccessDenial(body) && body.reason === "USER_DISABLED";
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
      void shouldLeave(res).then(leave => (leave ? leaveToLogin(originalFetch) : undefined));
    }
    return res;
  };
};
