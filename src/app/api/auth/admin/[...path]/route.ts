import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyAuth} from "@/lib/authProxy";

/**
 * Админка: `/api/auth/admin/**` один в один. Сегменты пути проверяются — они
 * подставляются в адрес бэкенда, и `..` или пустой сегмент туда попасть не должен.
 * Права проверяет auth (403 NOT_ADMIN), здесь — только проброс.
 */
const SEGMENT = /^[A-Za-z0-9_-]+$/;

const handler = protectedRoute(async (req: NextRequest, {token, params}) => {
  const segments: string[] = Array.isArray(params.path) ? params.path : [];
  if (!segments.length || !segments.every(s => SEGMENT.test(s))) {
    return NextResponse.json({message: "Недопустимый путь"}, {status: 400});
  }
  return proxyAuth(req, token, `/api/auth/admin/${segments.join("/")}`);
});

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
