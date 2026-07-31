import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

type Handler<T = any> = (
  request: NextRequest,
  ctx: {token: string, params: any}
) => Promise<NextResponse<T>>;

/**
 * Имя пользователя из JWT-клейма (для заголовка X-Username, нужного бэкенду при
 * переименовании свойства — см. PUT /api/editor/properties/{id}). Декодируем сами
 * (base64url среднего сегмента) — новой зависимости на JWT-библиотеку не заводим.
 * Клейм не подтверждён с бэкендом — пробуем несколько распространённых имён,
 * пустая строка, если ни один не найден.
 */
export function decodeJwtUsername(token: string): string {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf-8");
    const claims = JSON.parse(json) as Record<string, unknown>;
    const claim = claims.preferred_username ?? claims.username ?? claims.email ?? claims.sub;
    return typeof claim === "string" ? claim : "";
  } catch {
    return "";
  }
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