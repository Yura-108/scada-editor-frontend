# Контракт: инспектор объектов монитора

Дата: 01.10.2026. Backend-часть готова и протестирована (`runtime`, ветка `feat/object-inspector`,
`scada-o5we`). Реализация на фронте (scada-editor-frontend) — отдельная задача в том репозитории;
ниже — точный контракт и готовый код.

## Коротко: что и зачем

В старой SCADA у монитора было окно «Инспектор объектов» (`docs/oldversion/Инспектор1.png`,
`Инспектор2.png`): выпадающий список **всех объектов проекта**, у выбранного — таблица
«свойство · значение» с правкой на месте. Окно «Опции» его не заменяет: оно открывается только
щелчком по компоненту открытой сцены и показывает только свойства с тегом.

Инспектор умеет:

- выбрать любой объект prod-выпуска, со всех сцен, с поиском по имени;
- показать **все** его свойства: с тегом — живое значение из телеметрии, локальные — значение,
  которое держит `runtime` (его пишут скрипты);
- изменить значение: теговое — в ПЛК, как «Опции»; локальное — новой ручкой.

Вкладка «Сообщения» старого окна — второй этап (`scada-hskg`), сейчас её не делать.

## 1. Список объектов

```
GET /api/runtime/projects/{projectId}/objects
```

Ответ — объекты prod-выпуска, у которых есть свойства, по имени без учёта регистра. Заголовок
`X-Release-Version` — номер выпуска, из которого собран список.

```json
[
  {
    "id": 9, "name": "TANK1LT1", "type": "rect",
    "sceneId": 5, "sceneName": "Танки",
    "properties": [
      {"id": 20, "name": "CLEVEL", "label": "Уровень",
       "tag_id": "Барановичи-1.BN1_MCA1.TANK1LT1.CLEVEL", "value_type": "number",
       "default_value": null, "position": 1},
      {"id": 21, "name": "P_MAX", "label": null, "tag_id": null, "value_type": "number",
       "default_value": "80", "position": null}
    ]
  }
]
```

- Свойства идут по `position`, без номера — в конце.
- `sceneId`/`sceneName` — сцена, на которой стоит объект. `null` — объект вне сцен.
- `409` — проект не в эксплуатации.
- Список перечитывать при открытии окна и при смене выпуска: `releaseVersionNo` стора
  изменился. Номер выпуска приходит в `TREE_CHANGED` и в ответе сессии.

## 2. Значения — уже приходят по WS

`SNAPSHOT` и `UPDATE` несут значения **всего проекта**, не только открытой сцены, и движок
(`useRuntimeEngine`) уже складывает их все:

| Свойство | Где значение | Как прочитать |
|---|---|---|
| `tag_id` непустой | `valuesRef` по `tag_id`, качество — `tagMetaRef` | `getRuntimeTagValue(tag_id)` (есть), `getRuntimeTagQuality(tag_id)` (новый, §4) |
| `tag_id` пустой | `valuesByPropRef` по `id` свойства | `getRuntimePropertyValue(id)` (новый, §4) |

Достоверно только `quality === "GOOD"` — с `"BAD"` не сравнивать, рядом бывает `UNCERTAIN`.
Локального значения нет (`undefined`) — значит, оно не задано: показать пусто.

## 3. Запись

**Свойство с тегом** — как в «Опциях»: `POST /api/runtime/tags/write`, без изменений
(`{writes:[{tagId, value, valueType}], sessionId, projectId}`).

**Локальное свойство** — новая ручка:

```
POST /api/runtime/projects/{projectId}/properties/write
{"writes": [{"propertyId": 21, "value": "85"}]}
```

Ответ — массив того же размера и порядка, что `writes`:

```json
[{"propertyId": 21, "success": true, "status": "OK", "message": null}]
```

| `status` | Что показать |
|---|---|
| `OK` | ничего: новое значение придёт в `UPDATE.properties` всем мониторам, включая этот |
| `INVALID_VALUE` | `message`: число не число, bool не из `true/false, 1/0, on/off, yes/no, да/нет` |
| `TAG_PROPERTY` | ошибка фронта: теговое свойство пишется через `tags/write` |
| `UNKNOWN_PROPERTY` | список устарел: перечитать `/objects` |

- `value` — всегда строка, тип приводит бэк по `value_type` из выпуска.
- `409` — проект не в эксплуатации.
- Запись попадает в журнал действий: `kind = PROPERTY_WRITE`, пользователь берётся из токена.
- Записанное локально **не** подставлять: UPDATE приходит за десятки миллисекунд, и только он
  гарантирует, что окно показывает то, что на самом деле лежит в `runtime`.

## 4. Код

### 4.1 `src/types/runtimeWrite.types.ts` — дописать

```ts
/** Объект инспектора: компонент prod-выпуска со свойствами (GET …/objects). */
export interface InspectorPropertyDto {
  id: number;
  name: string;
  label: string | null;
  tag_id: string | null;
  value_type: string | null;
  default_value: string | null;
  position: number | null;
}

export interface InspectorObjectDto {
  id: number;
  name: string | null;
  type: string | null;
  sceneId: number | null;
  sceneName: string | null;
  properties: InspectorPropertyDto[];
}

export interface PropertyWriteItemDto { propertyId: number; value: string; }
export interface PropertyWriteRequestDto { writes: PropertyWriteItemDto[]; }

export type PropertyWriteStatus = "OK" | "UNKNOWN_PROPERTY" | "TAG_PROPERTY" | "INVALID_VALUE";

export interface PropertyWriteResultDto {
  propertyId: number;
  success: boolean;
  status: PropertyWriteStatus | string;
  message: string | null;
}
```

### 4.2 `src/lib/runtime/runtimeEventBus.ts` — два геттера рядом с `getRuntimeTagValue`

```ts
/** Значения локальных свойств держит движок (`valuesByPropRef`) — инспектор читает геттером. */
type PropertyValueGetter = (propertyId: number) => string | undefined;
let propertyValueGetter: PropertyValueGetter | null = null;
export const setRuntimePropertyValueGetter = (g: PropertyValueGetter | null): void => {
  propertyValueGetter = g;
};
export const getRuntimePropertyValue = (propertyId: number): string | undefined =>
  propertyValueGetter?.(propertyId);

/** Качество тега (`tagMetaRef`): достоверно только "GOOD". */
type TagQualityGetter = (tagId: string) => string | undefined;
let tagQualityGetter: TagQualityGetter | null = null;
export const setRuntimeTagQualityGetter = (g: TagQualityGetter | null): void => {
  tagQualityGetter = g;
};
export const getRuntimeTagQuality = (tagId: string): string | undefined =>
  tagQualityGetter?.(tagId);
```

### 4.3 `src/lib/runtime/useRuntimeEngine.ts` — зарегистрировать там же, где `setRuntimeValueGetter`

```ts
    setRuntimeValueGetter(tagId => valuesRef.current.get(tagId));
    setRuntimePropertyValueGetter(id => valuesByPropRef.current.get(id));
    setRuntimeTagQualityGetter(tagId => tagMetaRef.current.get(tagId)?.quality);
    // …
    return () => {
      // …
      setRuntimePropertyValueGetter(null);
      setRuntimeTagQualityGetter(null);
    };
```

### 4.4 `src/components/monitor/ObjectInspectorModal.tsx` — новый

Окно открывается так же, как «Опции» (`useModalStore`), значения перечитываются раз в секунду
(тот же приём, что `VALUE_POLL_MS` в «Опциях»: значения лежат в рефах движка, а не в сторе).

```tsx
"use client";

import React, {useEffect, useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Waypoints} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {isBooleanValueType} from "@/lib/editor/valueTypes";
import {
  getRuntimePropertyValue, getRuntimeSessionId, getRuntimeTagQuality, getRuntimeTagValue,
  notifyRuntimeTagsWritten,
} from "@/lib/runtime/runtimeEventBus";
import {Button, ModalFooter} from "@/components/ui/Button";
import {
  InspectorObjectDto, InspectorPropertyDto, PropertyWriteResultDto, TagWriteRequestDto,
  normalizeTagWriteResults, tagWriteOutcome, tagWriteStatusLabel,
} from "@/types/runtimeWrite.types";

const VALUE_POLL_MS = 1000;
const title = (p: InspectorPropertyDto) => p.label?.trim() || p.name;

function ObjectInspectorContent({initialObjectId}: {initialObjectId?: number}) {
  const closeModal = useModalStore((s) => s.closeModal);
  const projectId = useEditorStore((s) => s.currentProject?.id ?? null);
  const releaseVersionNo = useEditorStore((s) => s.releaseVersionNo);

  const [objects, setObjects] = useState<InspectorObjectDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialObjectId ?? null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [writing, setWriting] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), VALUE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Перечитываем при смене выпуска: у нового выпуска могли смениться объекты и id свойств.
  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    fetch(`/api/runtime/projects/${projectId}/objects`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`objects → ${res.status}`))))
      .then((list: InspectorObjectDto[]) => { if (!cancelled) setObjects(list); })
      .catch(err => toast.error(`Список объектов не загружен: ${err.message}`));
    return () => { cancelled = true; };
  }, [projectId, releaseVersionNo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? objects.filter(o => (o.name ?? "").toLowerCase().includes(q)) : objects;
  }, [objects, query]);
  const selected = objects.find(o => o.id === selectedId) ?? null;

  const valueOf = (p: InspectorPropertyDto) =>
    p.tag_id ? getRuntimeTagValue(p.tag_id) : getRuntimePropertyValue(p.id);
  const isBad = (p: InspectorPropertyDto) =>
    !!p.tag_id && getRuntimeTagQuality(p.tag_id) !== undefined && getRuntimeTagQuality(p.tag_id) !== "GOOD";

  const write = async (p: InspectorPropertyDto) => {
    if (projectId == null) return;
    const value = drafts[p.id] ?? "";
    setWriting(p.id);
    try {
      if (p.tag_id) {
        // Теговое — в ПЛК, ровно как «Опции».
        const body: TagWriteRequestDto = {
          writes: [{tagId: p.tag_id, value, valueType: p.value_type ?? undefined}],
          sessionId: getRuntimeSessionId() ?? undefined,
          projectId,
        };
        const res = await fetch("/api/runtime/tags/write", {
          method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`tags/write → ${res.status}`);
        const [result] = normalizeTagWriteResults(await res.json());
        const outcome = result ? tagWriteOutcome(result) : "failed";
        if (outcome === "failed") {
          toast.error(`«${title(p)}»: ${result ? tagWriteStatusLabel(result) : "нет отчёта"}`);
          return;
        }
        // "unknown" (NO_CONFIRMATION): команда ушла, но ПЛК не подтвердил — как в «Опциях».
        if (outcome === "unknown") toast.warning(`«${title(p)}»: результат неизвестен — сверьтесь с телеметрией`);
        notifyRuntimeTagsWritten([{tagId: p.tag_id, value}]);
      } else {
        const res = await fetch(`/api/runtime/projects/${projectId}/properties/write`, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({writes: [{propertyId: p.id, value}]}),
        });
        if (!res.ok) throw new Error(`properties/write → ${res.status}`);
        const [result]: PropertyWriteResultDto[] = await res.json();
        if (!result?.success) {
          toast.error(result?.message ?? `«${title(p)}»: не записано`);
          return;
        }
      }
      setDrafts(({[p.id]: _, ...rest}) => rest);
    } catch (e) {
      toast.error(`«${title(p)}»: ${(e as Error).message}`);
    } finally {
      setWriting(null);
    }
  };

  const inputClass = cn(
    "w-full rounded-lg border bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700",
    "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
    "outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4 space-y-2">
        <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
          Инспектор объектов
        </Dialog.Title>
        <Dialog.Description className="sr-only">Свойства любого объекта проекта</Dialog.Description>
        <input value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Поиск объекта" className={inputClass} />
        <select value={selectedId ?? ""} onChange={e => setSelectedId(Number(e.target.value) || null)}
                className={inputClass}>
          <option value="">— выберите объект —</option>
          {filtered.map(o => (
            <option key={o.id} value={o.id}>
              {o.name ?? `#${o.id}`}{o.sceneName ? ` · ${o.sceneName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {!selected ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500 italic">
            Выберите объект
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {selected.properties.map(p => {
              const value = valueOf(p);
              const isBool = isBooleanValueType(p.value_type ?? "");
              const draft = drafts[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                  {p.tag_id
                    ? <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" aria-label="тег" />
                    : <span className="h-4 w-4 shrink-0" />}
                  <span className="w-40 shrink-0 truncate text-sm text-gray-900 dark:text-gray-100"
                        title={p.tag_id ?? p.name}>
                    {title(p)}
                  </span>
                  {isBool ? (
                    <input type="checkbox" className="h-4 w-4"
                           checked={(draft ?? value) === "true"}
                           onChange={e => setDrafts({...drafts, [p.id]: e.target.checked ? "true" : "false"})} />
                  ) : (
                    <input value={draft ?? value ?? ""}
                           onChange={e => setDrafts({...drafts, [p.id]: e.target.value})}
                           onKeyDown={e => { if (e.key === "Enter" && draft !== undefined) void write(p); }}
                           className={cn(inputClass, "flex-1", isBad(p) && "text-gray-400 line-through")} />
                  )}
                  <button type="button" onClick={() => void write(p)}
                          disabled={draft === undefined || writing !== null}
                          className={cn(
                            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white",
                            p.tag_id ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500",
                            "disabled:bg-gray-400 disabled:cursor-not-allowed",
                          )}>
                    {writing === p.id ? "Запись..." : p.tag_id ? "В ПЛК" : "Задать"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/** Открывает инспектор; `initialObjectId` — сразу выбрать объект (из меню компонента). */
export function openObjectInspectorModal(props: {initialObjectId?: number} = {}) {
  useModalStore.getState().openModal(<ObjectInspectorContent {...props} />);
}
```

Пока оператор правит поле, черновик (`drafts`) перекрывает живое значение. После записи
черновик снимается, и поле снова показывает значение из потока.

### 4.5 Где открывать

- **Кнопка «Инспектор» в шапке монитора** (`MonitorClient.tsx`, рядом с «Задачи», при
  `isLive && sessionId`): `openObjectInspectorModal()`.
- **Пункт «Инспектор» в контекстном меню компонента** (`buildMonitorMenu.ts`, рядом с «Опции»):
  `openObjectInspectorModal({initialObjectId: el.id ?? undefined})`. `el.id` у
  `BaseCanvasElement` — серверный id компонента, на сценах выпуска он есть всегда.

В архиве инспектор не показывать: записи там невозможны, а значения — из прошлого.

## Проверка

1. Проект в эксплуатации, монитор открыт в двух вкладках.
2. «Инспектор» → в списке объекты всех сцен; выбрать объект **не** с текущей сцены → значения
   теговых свойств живые.
3. Локальное числовое свойство → `85` → «Задать» → в обеих вкладках `85`. Ввести `много` →
   тост «значение «много» не является числом».
4. Теговое свойство → «В ПЛК» → значение доехало, как из «Опций».
5. `GET /api/runtime/actions?from=…&to=…&kind=PROPERTY_WRITE` — строка с пользователем.
