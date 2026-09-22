import {protectedRoute} from "@/lib/protected";
import {backendErrorResponse} from "@/lib/backendProxy";
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Готовый блок тегов для `controllers.yaml` шлюза — текстом, как его вернул бэкенд.
 *
 * `404` означает, что под указанным корнем нет каналов с параметром «Имя в ПЛК»: так
 * отвечает старая база, собранная не импортом. Это не поломка, а объяснимый отказ, и его
 * текст надо показать целиком.
 */
export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const {searchParams} = new URL(req.url);
  const root = searchParams.get('root');
  const controllerId = searchParams.get('controllerId');
  const endpoint = searchParams.get('endpoint');

  if (!root || !controllerId || !endpoint) {
    return NextResponse.json(
      {message: 'Нужны параметры root, controllerId и endpoint'},
      {status: 400},
    );
  }

  // `URLSearchParams` кодирует кириллицу в `root` сам — руками собирать строку нельзя.
  const query = new URLSearchParams({root, controllerId, endpoint});

  const response = await fetch(`${BACKEND_URL}/api/channel/export/gateway?${query}`, {
    method: 'GET',
    headers: {Authorization: `Bearer ${token}`},
  });

  if (!response.ok) return backendErrorResponse(response);

  const text = await response.text();
  return new NextResponse(text, {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
});
