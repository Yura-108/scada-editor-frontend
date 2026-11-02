import { NextResponse } from 'next/server';

/**
 * Ответ прокси на неуспешный ответ бэкенда.
 *
 * Раньше роуты в этом случае делали `throw new Error(...)`. В App Router это
 * превращается в непрозрачный HTML-500: клиентский `parseBackendErrorMessage`
 * не находил в нём `message`, вываливал в тост 200 символов разметки, а в dev
 * туда же попадал стек-трейс. Реальная причина (например, «свойство с таким
 * именем уже существует») до пользователя не доходила вовсе.
 *
 * Здесь статус и тело бэкенда проходят насквозь: Spring отдаёт
 * `{status, message, error, timestamp}`, и клиент показывает `message`.
 */
export async function backendErrorResponse(response: Response): Promise<NextResponse> {
  const text = await response.text().catch(() => '');

  return new NextResponse(text || JSON.stringify({ message: `Ошибка ${response.status}` }), {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
