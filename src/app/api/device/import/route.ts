import {protectedRoute} from "@/lib/protected";
import {backendErrorResponse} from "@/lib/backendProxy";
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Импорт базы каналов из файла `.cdbx` в НОВЫЙ проект.
 *
 * Форма несёт `file`, `site` и `project`; площадку и проект вводит пользователь — из файла
 * они не берутся. Бэкенд делает всё одной транзакцией: при ошибке в базе не появляется
 * ничего, поэтому повторять импорт после отказа безопасно.
 *
 * Отказы приходят телом Spring и показываются оператору дословно: `409` — проект уже есть
 * (импорт умеет только создавать), `400` — не `.cdbx`, битый XML, нет каналов, пустое имя
 * или имя с точкой.
 */
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const form = await req.formData();

  const response = await fetch(`${BACKEND_URL}/api/channel/import/cdbx`, {
    method: 'POST',
    // `Content-Type` НЕ выставляем руками, в отличие от соседних роутов: у multipart в нём
    // едет `boundary`, который `fetch` генерирует сам под это тело. Скопировав заголовок
    // входящего запроса, мы отдали бы бэкенду чужой boundary, и тело не разобралось бы.
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);
  return NextResponse.json(data);
});
