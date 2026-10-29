import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {resolveSession} from "@/server/auth/sessionRefresh";
import {ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, setSessionCookies} from "@/server/auth/setTokenCookies";
import {decodeJwtClaims} from "@/server/auth/jwtClaims";

export {decodeJwtClaims};

type Handler<T = any> = (
  request: NextRequest,
  ctx: {token: string, params: any}
) => Promise<NextResponse<T>>;

/**
 * Имя пользователя из JWT-клейма (для заголовка X-Username, нужного бэкенду при
 * переименовании свойства — см. PUT /api/editor/properties/{id}).
 * Клейм не подтверждён с бэкендом — пробуем несколько распространённых имён,
 * пустая строка, если ни один не найден.
 */
export function decodeJwtUsername(token: string): string {
  const claims = decodeJwtClaims(token);
  if (!claims) return "";
  const claim = claims.preferred_username ?? claims.username ?? claims.email ?? claims.sub;
  return typeof claim === "string" ? claim : "";
}

/**
 * Обёртка маршрута BFF: достаёт access-токен из cookie и отдаёт обработчику. Нет его или он вот-вот
 * истечёт — сначала обновляет пару по `refresh_token` (`resolveSession`) и ставит обе cookie
 * на ответ: cookie, выставленные через `cookies()`, Next дописывает к ответу обработчика сам.
 */
export function protectedRoute(handler: Handler) {
  return async (request: NextRequest, {params}: {params: Promise<any>}) => {
    const cookieStore = await cookies();
    const access = cookieStore.get(ACCESS_COOKIE)?.value;
    const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
    const session = await resolveSession(access, refresh);

    let token: string;
    if (session.kind === "valid") {
      token = session.token;
    } else if (session.kind === "refreshed") {
      setSessionCookies(cookieStore, session.pair, request);
      token = session.pair.token;
    } else if (session.kind === "unavailable" && session.token) {
      token = session.token;
    } else if (session.kind === "unavailable") {
      return NextResponse.json({ message: "Сервис входа недоступен, повторите позже" }, { status: 503 });
    } else {
      // Клиентский authInterceptor уводит на /login по 401.
      const response = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      if (access || refresh) clearSessionCookies(response.cookies, request);
      return response;
    }

    const resolvedParams = await params;

    return handler(request, {token, params: resolvedParams});
  }
}