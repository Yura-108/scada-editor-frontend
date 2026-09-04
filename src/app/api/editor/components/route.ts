import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {normalizeSaveResponse, toSaveEnvelope} from '@/lib/saveEnvelope';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, {token}) => {

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

/**
 * Сохранение сцены.
 *
 * Конверт `{components, scene_id, based_on_version, save_kind}` (§1 контракта версий)
 * уходит бэкенду как есть — методом `PUT`, без изменения формы. Ответ нормализуется к
 * `{components, version_no}`.
 *
 * Тело `PUT` описывает состав сцены ЦЕЛИКОМ: компонент, которого в нём нет, бэкенд
 * удаляет. Клиент это и присылает — `buildComponentTree` сериализует все элементы сцены,
 * частичных сохранений в редакторе нет. Поэтому отдельного `DELETE` компонентов больше
 * нет: удаление персистится ближайшим сохранением.
 */
export const PUT = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const envelope = toSaveEnvelope(body);

  // Не конверт — тело по старому контракту (голый массив) либо мусор. Отвечаем
  // отдельным текстом: «пустое окно» здесь увело бы в неверную сторону.
  if (!envelope) {
    return NextResponse.json(
      {message: "Некорректное тело запроса: ожидается конверт сохранения."},
      {status: 400}
    );
  }

  if (!envelope.components.length) {
    return NextResponse.json(
      {message: "Окно редактирования пустое!"},
      {status: 400}
    );
  }

  // `scene_id` обязателен по контракту. Проверяем у себя: 400 с внятным текстом
  // полезнее, чем тот же 400 от бэкенда без указания, чего не хватило.
  if (envelope.scene_id == null) {
    return NextResponse.json(
      {message: "Не указана сцена (scene_id) — сохранять состав нечему."},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  });

  // Бэкенд мог отклонить сохранение (например, невалидный payload). Раньше прокси
  // ВСЕГДА возвращал 201, поэтому клиент считал сохранение успешным, перезагружал
  // сцену и получал пустой ответ — затирая холст несохранёнными данными.
  // Пробрасываем реальный статус и тело ошибки, чтобы exportScene не перезагружал сцену.
  // Здесь же насквозь проходит 409 со списком расхождений — его разбирает клиент.
  if (!response.ok) return backendErrorResponse(response);

  const editorElements = await response.json().catch(() => null);

  // 200, а не 201: сохранение существующей сцены — обновление, а не создание.
  return NextResponse.json(normalizeSaveResponse(editorElements));
});

/**
 * Удаление документов и компонентов — массовое, конвертом (§1 контракта версий).
 *
 * ```json
 * { "ids": [1, 2, 3], "based_on_version": 47 }
 * ```
 *
 * Раньше фронт удалял поштучно по адресам `DELETE /api/editor/components/{id}` (проект) и
 * `DELETE /api/editor/components/scene/{id}` (схема) — их на бэкенде больше нет, оба
 * отвечали 500.
 *
 * `based_on_version` необязателен ровно на тех же условиях, что у `PUT`: у сцены без
 * единой версии его слать нельзя (400), поэтому поле уходит только когда клиент реально
 * знает номер. `DELETE` версию лишь СВЕРЯЕТ, не сливает: расхождение — безусловный
 * `409 version_mismatch`, и он проходит насквозь к клиенту вместе с телом.
 */
export const DELETE = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);

  const rawIds = (body as {ids?: unknown} | null)?.ids;
  const ids = Array.isArray(rawIds) ? rawIds.map(Number) : [];
  if (!ids.length || !ids.every(Number.isSafeInteger)) {
    return NextResponse.json(
      {message: "Некорректное тело запроса: ожидается { ids: [1, 2, 3] } с целыми идентификаторами."},
      {status: 400}
    );
  }

  const basedOn = (body as {based_on_version?: unknown} | null)?.based_on_version;
  const payload: {ids: number[]; based_on_version?: number} = {ids};
  if (typeof basedOn === "number" && Number.isSafeInteger(basedOn)) {
    payload.based_on_version = basedOn;
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return backendErrorResponse(response);

  return NextResponse.json({success: true});
});
