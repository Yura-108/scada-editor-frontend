import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

type Handler<T = any> = (
  request: NextRequest,
  ctx: {token: string, params: any}
) => Promise<NextResponse<T>>;

/**
 * Клеймы JWT без проверки подписи: разбираем средний сегмент (base64url) сами —
 * новой зависимости на JWT-библиотеку не заводим. Подпись проверяет бэкенд; нам
 * клеймы нужны только для служебных вещей (имя пользователя, срок жизни cookie).
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

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

export function protectedRoute(handler: Handler) {
  return async (request: NextRequest, {params}: {params: Promise<any>}) => {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;

    return handler(request, {token, params: resolvedParams});
  }
}