import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {
  normalizeSaveResponse,
  saveBackendRequest,
  saveEnvelopeEnabled,
  toSaveEnvelope,
} from '@/lib/saveEnvelope';
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
 * Клиент всегда присылает конверт `{components, scene_id, based_on_version, save_kind}`
 * (§1 контракта версий) методом `PUT`. Что уйдёт бэкенду — `PUT` с конвертом или
 * legacy-`POST` с голым массивом — решает `EDITOR_SAVE_ENVELOPE` (см. lib/saveEnvelope.ts).
 * Ответ нормализуется к `{components, version_no}` независимо от формы ответа бэкенда.
 *
 * Тело `PUT` описывает состав сцены ЦЕЛИКОМ: компонент, которого в нём нет, бэкенд
 * удаляет. Клиент это и присылает — `buildComponentTree` сериализует все элементы сцены,
 * частичных сохранений в редакторе нет.
 */
const saveComponents = async (req: NextRequest, token: string) => {
  const body = await req.json().catch(() => null);
  const envelope = toSaveEnvelope(body);
  console.log(req)
  if (!envelope || !envelope.components.length) {
    return NextResponse.json(
      {message: "Окно редактирования пустое!"},
      {status: 400}
    );
  }

  // `scene_id` обязателен для `PUT` по контракту. Проверяем у себя: 400 с внятным
  // текстом полезнее, чем тот же 400 от бэкенда без указания, чего не хватило.
  // Пока конверт выключен, поле до бэкенда всё равно не доходит — не требуем его.
  if (saveEnvelopeEnabled() && envelope.scene_id == null) {
    return NextResponse.json(
      {message: "Не указана сцена (scene_id) — сохранять состав нечему."},
      {status: 400}
    );
  }

  const {method, body: backendBody} = saveBackendRequest(envelope);

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backendBody),
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
};

/** Основной путь сохранения — им ходит редактор. */
export const PUT = protectedRoute(async (req: NextRequest, {token}) => saveComponents(req, token));

/** Оставлен для совместимости: ручные запросы и старые клиенты ходили `POST`. */
export const POST = protectedRoute(async (req: NextRequest, {token}) => saveComponents(req, token));

/**
 * Удаление компонентов — только для старого контракта.
 *
 * По новому контракту удалять отдельным запросом не нужно и не следует: тело `PUT`
 * описывает состав сцены целиком, и компонент исчезает уже потому, что его в теле нет.
 * Второй версионируемый путь записи (со своим `based_on_version` и своим 409) нам не
 * нужен, поэтому конверт `{ids, based_on_version}` здесь не реализован намеренно.
 *
 * Редактор этот роут не вызывает. Он остаётся точкой отката: пока
 * `EDITOR_SAVE_ENVELOPE` выключен, бэкенд сохраняет сцену upsert-ом и без явного
 * удаления разгруппированная группа вернулась бы после следующего сохранения.
 */
export const DELETE = protectedRoute(async (req: NextRequest, {token}) => {
  const ids = await req.json().catch(() => null);

  if (!ids) {
    return NextResponse.json(
      {error: "ID не переданы!"},
      {status: 400}
    );
  }

  if (saveEnvelopeEnabled()) {
    // Ничего не делаем осознанно: удаление уедет ближайшим `PUT`. Отвечаем успехом,
    // чтобы вызывающий (если он появится) не откатывал локальное состояние.
    return NextResponse.json({skipped: true}, {status: 200});
  }

  const response = await fetch(`${BACKEND_URL}/api/editor/components`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ids),
  });

  // Как и в POST: не маскируем ошибку бэкенда статусом 201 — пробрасываем реальный ответ.
  if (!response.ok) return backendErrorResponse(response);

  const editorElements = await response.json().catch(() => null);

  return NextResponse.json(editorElements, {status: 201});
})
