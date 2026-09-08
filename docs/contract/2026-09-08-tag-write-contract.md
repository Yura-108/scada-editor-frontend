# Контракт: точечная запись тега в ПЛК — новый эндпоинт, изменения для фронта

Дата: 08.09.2026. Backend-часть готова и протестирована (`runtime`), реализация на фронте
(scada-editor-frontend) — отдельная задача в том репозитории, ниже — точный контракт и
готовый код для трёх файлов.

## Коротко: что происходит и зачем

Кнопка «Записать в ПЛК» в «Опциях» компонента монитора (`ElementOptionsModal.tsx`) стучится
в `POST /api/runtime/tags/write` — а такого эндпоинта в `runtime` не было **вообще**: только
`/api/runtime/sessions` и `/api/runtime/recipes/apply`. Запрос честно доходил через шлюз
(`Path=/api/runtime/**`), упирался в отсутствующий хендлер и в итоге всплывал как `500
Internal Server Error`. Эндпоинт реализован с нуля.

**Заодно поменялась форма контракта: запрос и ответ — всегда массив.** Раньше
`TagWriteRequestDto`/`TagWriteResultDto` были рассчитаны на один тег за раз. По факту записи
всегда потребуется несколько (например, записать сразу все теги компонента, а не только один
ряд) — переделывать контракт на массив вторым заходом, когда экран научится писать пачкой,
дороже, чем сразу принять массив и вызывать его с одним элементом для точечного случая.
Отдельной ручки под «записать один тег» нет и не будет — единичная запись это `writes`
из одного элемента.

## 1. Новый эндпоинт

```
POST /api/runtime/tags/write
```

### Запрос

```json
{
  "writes": [
    { "tagId": "Барановичи-1.BN1_MCA1.V_ST_1.LINE1V1.ST", "value": "true", "valueType": "boolean" }
  ],
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": 8501
}
```

- `writes` — обязателен, непустой массив. Один элемент = точечная запись.
- `writes[].tagId` — обязателен, полный путь канала (`tag_id` свойства). Числовых id нет и не
  будет.
- `writes[].value` — значение как ввёл оператор, **строкой**. Пустая строка — допустимое
  значение (строковый тег), поэтому поле обязано присутствовать, но не обязано быть непустым.
- `writes[].valueType` — `value_type` свойства (`"boolean"`/`"integer"`/`"float"`/…),
  опционально. Без него бэк отправит значение как есть строкой — драйвер разберётся сам, но
  для boolean-тегов это может уйти неверной уставкой (см. ниже), поэтому передавайте всегда,
  когда `value_type` свойства известен (он у вас уже есть в `PropertyCreateDto`).
- `sessionId`, `projectId` — опционально, только для контекста/логов на бэке. Запись не
  привязана к состоянию сессии мониторинга: тег адресуется напрямую по `tagId`.

### Ответ — массив того же размера и порядка, что `writes`

```json
[
  { "tagId": "Барановичи-1.BN1_MCA1.V_ST_1.LINE1V1.ST", "success": true, "status": "APPLIED", "message": "Записано значение true" }
]
```

- Порядок ответа совпадает с порядком `writes` — сопоставлять по индексу, `tagId` в ответе
  дублируется для удобства, но не для поиска.
- `status` — один из кодов шлюза (`APPLIED`, `REJECTED_UNKNOWN_TAG`, `REJECTED_NOT_WRITABLE`,
  `REJECTED_TYPE_MISMATCH`, `REJECTED_PROTOCOL_UNSUPPORTED`, `FAILED_NO_CONNECTION`,
  `FAILED_WRITE`) либо локальный: `INVALID_VALUE` (значение не привелось к `valueType`,
  например `"да"` вместо `true`/`false` при неизвестном написании) или `NO_CONFIRMATION`
  (шлюз не ответил за отведённое время — применилась команда или нет, неизвестно).
- `success=false` — не сетевая ошибка, а отказ по существу (тег read-only, нет связи и т.п.).
  Показывать `message` оператору как есть.
- HTTP-статус ответа — всегда `200`, если тело запроса прошло валидацию (`400` только на
  пустой/кривой `writes`). Отказ конкретной записи — внутри элемента массива, не в HTTP-коде.

## 2. Что менять на фронте — три файла, код ниже

### `src/types/runtimeWrite.types.ts` — заменить целиком

```ts
/**
 * Запись значений тегов в ПЛК из монитора («Опции» компонента).
 *
 * Всегда массив — точечная запись одного тега это массив из одного элемента, отдельного
 * контракта под единичный случай нет. Форма результата — с бэка (`TagWriteResult` в
 * `runtime`): порядок ответа совпадает с порядком `writes` в запросе, один результат на
 * один элемент. Адрес тега — ПУТЬ КАНАЛА (`tagId` == `tag_id` свойства): числовых
 * идентификаторов в команде нет и не будет — `docs/contract/TAG_CONTRACT_CHANGES.md`.
 */

/** Расширяемый список: неизвестный статус трактуем как отказ, а не роняем разбор. */
export type TagWriteStatus =
  | "APPLIED"
  | "INVALID_VALUE"
  | "REJECTED_UNKNOWN_TAG"
  | "REJECTED_NOT_WRITABLE"
  | "REJECTED_TYPE_MISMATCH"
  | "REJECTED_PROTOCOL_UNSUPPORTED"
  | "FAILED_NO_CONNECTION"
  | "FAILED_WRITE"
  | "NO_CONFIRMATION"
  | string;

export interface TagWriteItemDto {
  /** Полный путь канала — он же `tag_id` свойства компонента. */
  tagId: string;
  /** Значение как ввёл оператор; типизацию делает бэкенд по `valueType`. */
  value: string;
  /** `value_type` свойства ("boolean"/"integer"/"float"/…); без него уходит строкой. */
  valueType?: string;
}

export interface TagWriteRequestDto {
  writes: TagWriteItemDto[];
  sessionId?: string;
  projectId: number | null;
}

export interface TagWriteResultDto {
  tagId: string;
  status: TagWriteStatus;
  success: boolean;
  /** Пояснение от шлюза — показываем оператору как есть. */
  message?: string;
}

/** Подписи статусов для оператора. Неизвестный статус показываем самим кодом. */
export const TAG_WRITE_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Записано",
  INVALID_VALUE: "Значение не подходит по типу",
  REJECTED_UNKNOWN_TAG: "Тег не найден на шлюзе",
  REJECTED_NOT_WRITABLE: "Тег доступен только для чтения",
  REJECTED_TYPE_MISMATCH: "Значение не подходит по типу",
  REJECTED_PROTOCOL_UNSUPPORTED: "Протокол не поддерживает запись",
  FAILED_NO_CONNECTION: "Нет связи с контроллером",
  FAILED_WRITE: "Ошибка записи",
  NO_CONFIRMATION: "Ответ шлюза не получен",
};

export const tagWriteStatusLabel = (result: TagWriteResultDto): string =>
  TAG_WRITE_STATUS_LABELS[result.status] ?? result.status;
```

Что изменилось относительно старого файла: `TagWriteRequestDto` получил `writes: TagWriteItemDto[]`
вместо одиночных `tagId`/`value`; `TagWriteResultDto` потерял `commandId`/`tagName`/`appliedValue`/
`timestamp` — эти поля бэк никогда не заполнял (в `CommandOutcome` их просто нет), а нигде в коде
компонента не читались, так что это не потеря, а приведение типа к тому, что реально приходит.
Добавлены статусы `INVALID_VALUE`/`NO_CONFIRMATION` — раньше их не было в списке подписей.

### `src/app/api/runtime/tags/write/route.ts` — заменить тело обработчика

```ts
import {NextRequest, NextResponse} from "next/server";
import {protectedRoute} from "@/lib/protected";

// Как и применение рецепта: REST идёт через gateway, не напрямую на :8085.
const BACKEND_URL = process.env.BACKEND_URL_RUNTIME || process.env.BACKEND_URL || "http://localhost:8080";

/**
 * Запись значений тегов в ПЛК («Опции» компонента в мониторе). Всегда массив —
 * точечная запись одного тега это массив из одного элемента, отдельного контракта
 * под единичный случай нет (на бэке тоже один эндпоинт, `TagWriteController`).
 *
 * Адрес тега — ПУТЬ КАНАЛА (`tagId` == `tagName` в команде шлюза). Числовые
 * идентификаторы наружу не публикуются и для записи не годятся —
 * docs/contract/TAG_CONTRACT_CHANGES.md, принцип 1 и A4.
 */
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const body = await req.json().catch(() => null);
  const writes = Array.isArray(body?.writes) ? body.writes : null;

  if (!writes || writes.length === 0) {
    return NextResponse.json(
        {error: "Параметр writes обязателен и должен быть непустым массивом"},
        {status: 400},
    );
  }

  const normalized = [];
  for (const item of writes) {
    const tagId = typeof item?.tagId === "string" ? item.tagId.trim() : "";
    if (!tagId) {
      return NextResponse.json(
          {error: "Каждый элемент writes должен иметь непустой tagId"},
          {status: 400},
      );
    }
    // Пустая строка — допустимое значение (строковый тег), а вот отсутствие поля нет:
    // иначе на контроллер уйдёт запись неизвестно чего.
    if (item?.value === undefined || item?.value === null) {
      return NextResponse.json(
          {error: `«${tagId}»: параметр value обязателен`},
          {status: 400},
      );
    }
    normalized.push({tagId, value: String(item.value), valueType: item?.valueType});
  }

  // sessionId нужен бэкенду только для контекста/логов (как и в apply рецепта).
  // Таймаут больше клиентского (20с): ответ ждёт подтверждения брокера, и обрывать
  // запрос раньше бэкенда BFF не должен.
  const response = await fetch(`${BACKEND_URL}/api/runtime/tags/write`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      writes: normalized,
      sessionId: body?.sessionId,
      projectId: body?.projectId,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await response.json().catch(() => null);

  // Пробрасываем реальный статус бэкенда: отказ шлюза (REJECTED_*/FAILED_*) фронт
  // показывает оператору дословно, а не как «ошибку сети».
  return NextResponse.json(data, {status: response.status});
});
```

### `src/components/monitor/ElementOptionsModal.tsx` — правка внутри `write()`

Меняется только тело запроса и разбор ответа (весь остальной файл — подтверждение, чекбокс,
таймаут, обработка ошибок — не трогается). Было:

```ts
    setWritingTag(tagId);
    try {
      const res = await fetch("/api/runtime/tags/write", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({tagId, value: raw, sessionId, projectId}),
        // Тот же запас, что и у применения рецепта: ответ ждёт подтверждения брокера.
        signal: AbortSignal.timeout(20_000),
      });
      const result: TagWriteResultDto | null = await res.json().catch(() => null);

      if (!res.ok || !result) {
        const message = (result as unknown as {error?: string})?.error;
        throw new Error(message || `Ошибка записи (${res.status})`);
      }
```

Стало:

```ts
    setWritingTag(tagId);
    try {
      const res = await fetch("/api/runtime/tags/write", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        // Бэк всегда принимает массив — точечная запись это массив из одного элемента.
        body: JSON.stringify({
          writes: [{tagId, value: raw, valueType: property.value_type}],
          sessionId,
          projectId,
        }),
        // Тот же запас, что и у применения рецепта: ответ ждёт подтверждения брокера.
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => null);
      const result: TagWriteResultDto | null = Array.isArray(body) ? (body[0] ?? null) : null;

      if (!res.ok || !result) {
        const message = (body as unknown as {error?: string})?.error;
        throw new Error(message || `Ошибка записи (${res.status})`);
      }
```

Остальной код функции (`if (!result.success) {...}`, `setManualTagValue(...)`,
`toast.success(...)`, `catch`/`finally`) обращается только к `result.success`/`result.message`/
`property.name` — эти поля не переименованы, менять их не нужно.

## 3. Что не изменилось

- URL эндпоинта — тот же, `/api/runtime/tags/write`.
- Заголовок `Authorization: Bearer` и весь остальной BFF-прокси-путь через `protectedRoute`.
- Таймауты (20 с на клиенте, 25 с в BFF).
- Подтверждение перед записью (`confirmModal`) и текст предупреждения о необратимости —
  этого контракт вообще не касается, чистый UI.

## 4. Как проверить у себя после переноса

1. Открыть «Монитор» → любую сцену → ПКМ по компоненту с тег-свойством → «Опции».
2. Ввести значение, нажать «Записать в ПЛК» → подтвердить.
3. Ожидаемо: `200` с массивом из одного элемента, `success:true, status:"APPLIED"` на живом
   стенде с симулятором, тост «Записано». Раньше на этом же клике был `500`.
