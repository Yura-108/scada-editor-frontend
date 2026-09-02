import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

/**
 * Удаление компонента верхнего уровня — проекта.
 *
 * Проект и сцена для бэкенда — один и тот же вид компонента, поэтому адрес общий:
 * `DELETE /api/editor/components/{id}`. Каскад по вложенным компонентам (схемы проекта
 * и их элементы) делает бэкенд.
 *
 * Это не противоречит комментарию у `PUT` в соседнем `../route.ts`: там речь про элементы
 * ВНУТРИ сцены — их удаление персистится ближайшим полным сохранением, отдельного запроса
 * им не нужно. Сам же документ (проект/схема) полным `PUT` сцены удалить нельзя.
 */
export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {id} = params;

  const componentId = Number(id);
  if (!Number.isSafeInteger(componentId)) {
    return NextResponse.json(
      {error: "Идентификатор компонента должен быть целым числом (int64)"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components/${componentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  return NextResponse.json({success: true});
});
