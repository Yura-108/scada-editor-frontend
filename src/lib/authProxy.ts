import {NextRequest, NextResponse} from "next/server";

/** auth-сервис доступен через gateway под тем же BACKEND_URL, что и вход. */
const AUTH_BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

/**
 * Проброс запроса в auth-сервис с токеном пользователя: метод, тело и ответ как есть.
 * Ошибки auth — `{message}` (409 «логин занят», «последний администратор») или
 * отказ `{error: "FORBIDDEN", reason}`; разбирает их клиент.
 */
export async function proxyAuth(req: NextRequest, token: string, path: string): Promise<NextResponse> {
  const method = req.method;
  const body = method === "GET" || method === "DELETE" ? undefined : await req.text();
  const response = await fetch(`${AUTH_BACKEND_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? {"Content-Type": "application/json"} : {}),
    },
    body: body || undefined,
  });
  const text = await response.text().catch(() => "");
  // 204 не может нести тело — NextResponse с телом на 204 падает.
  if (response.status === 204) return new NextResponse(null, {status: 204});
  return new NextResponse(text || null, {
    status: response.status,
    headers: {"Content-Type": response.headers.get("content-type") ?? "application/json"},
  });
}
