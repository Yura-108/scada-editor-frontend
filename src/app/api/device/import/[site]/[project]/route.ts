import {protectedRoute} from "@/lib/protected";
import {backendErrorResponse} from "@/lib/backendProxy";
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Удаление импортированного проекта целиком, вместе с поддеревом; площадка остаётся.
 *
 * Бэкенд разрешает это только базе, созданной импортом — у её узла проекта есть параметр
 * «Источник импорта». Собранную руками базу (например, `BN1_MCA1`) он не удалит и ответит
 * `409`, а `404` означает, что такого проекта нет.
 *
 * Ошибку отдаём через `backendErrorResponse`, а не собираем `{error}` руками, как соседние
 * DELETE-роуты: в обоих отказах вся ценность в тексте бэкенда, и терять его нельзя.
 */
export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {site, project} = params as {site?: string; project?: string};

  if (!site || !project) {
    return NextResponse.json({message: 'Нужны площадка и проект'}, {status: 400});
  }

  // Кодируем оба сегмента: площадка кириллическая («Барановичи-1»), и без кодирования
  // путь до бэкенда не доедет.
  const path = `${encodeURIComponent(site)}/${encodeURIComponent(project)}`;

  const response = await fetch(`${BACKEND_URL}/api/channel/import/${path}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${token}`},
  });

  if (!response.ok) return backendErrorResponse(response);

  return new NextResponse(null, {status: 204});
});
