import {NextResponse} from "next/server";
import {protectedRoute} from "@/server/auth/protected";

/**
 * Освежить cookie перед подключением STOMP редактора: gateway читает `access_token` из cookie
 * сам, и если страница простояла дольше срока токена без запросов в BFF, сокет получил бы 401.
 * Обновление по `refresh_token` делает `protectedRoute`; токенов в ответе нет — только cookie.
 */
export const POST = protectedRoute(async () => new NextResponse(null, {status: 204}));
