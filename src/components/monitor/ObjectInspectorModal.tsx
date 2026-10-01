"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {AlertTriangle, Loader2, SlidersHorizontal, Waypoints} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {closeFloatingWindow, openFloatingWindow} from "@/store/useFloatingWindowsStore";
import {useEditorStore} from "@/store/useEditorStore";
import {isBooleanValueType, isNumericValueType} from "@/lib/editor/valueTypes";
import {shortTagPath} from "@/lib/editor/tagPath";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {
  getRuntimePropertyValue, getRuntimeSessionId, getRuntimeTagQuality, getRuntimeTagValue,
  notifyRuntimeTagsWritten,
} from "@/lib/runtime/runtimeEventBus";
import {Button, ModalFooter} from "@/components/ui/Button";
import {
  InspectorObjectDto, InspectorPropertyDto, PropertyWriteResultDto, TagWriteRequestDto,
  normalizeTagWriteResults, tagWriteOutcome, tagWriteStatusLabel,
} from "@/types/runtimeWrite.types";

/** Как часто перечитываем значения: они лежат в рефах движка, а не в сторе (как в «Опциях»). */
const VALUE_POLL_MS = 1000;
const title = (p: InspectorPropertyDto) => p.label?.trim() || p.name;

/** Снять черновик свойства — без деструктуризации с неиспользуемой переменной. */
const withoutDraft = (drafts: Record<number, string>, id: number) => {
  const next = {...drafts};
  delete next[id];
  return next;
};

/**
 * Инспектор объектов монитора (docs/contract/2026-10-01-object-inspector-contract.md).
 *
 * Любой объект prod-выпуска со всех сцен и все его свойства: с тегом — живое значение из
 * телеметрии, локальные — значение, которое держит runtime (его пишут скрипты). Значения всего
 * проекта уже приходят по WS (SNAPSHOT/UPDATE), движок держит их в рефах и отдаёт геттерами шины.
 *
 * Запись: теговое — в ПЛК (`tags/write`), как «Опции»; локальное — `properties/write`. Записанное
 * локально не подставляем: UPDATE приходит за десятки миллисекунд, и только он гарантирует, что
 * окно показывает то, что на самом деле лежит в runtime.
 */
function ObjectInspectorContent({initialObjectId, onClose}: {initialObjectId?: number; onClose: () => void}) {
  const projectId = useEditorStore((s) => s.currentProject?.id ?? null);
  const releaseVersionNo = useEditorStore((s) => s.releaseVersionNo);

  const [objects, setObjects] = useState<InspectorObjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialObjectId ?? null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [writing, setWriting] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), VALUE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Перечитываем при смене выпуска: у нового выпуска могли смениться объекты и id свойств.
  // `reloadKey` — по UNKNOWN_PROPERTY: бэк сказал, что список устарел.
  const load = useCallback(async (signal: AbortSignal) => {
    if (projectId == null) return;
    const res = await fetch(`/api/runtime/projects/${projectId}/objects`, {signal});
    if (res.status === 409) {
      // Состояние, а не сбой: проект не исполняется — объектов выпуска нет.
      const body = await res.json().catch(() => null) as {message?: string} | null;
      throw new Error(body?.message || "Проект не в эксплуатации — объекты выпуска недоступны");
    }
    if (!res.ok) throw new Error(`Список объектов не загружен (${res.status})`);
    const list = await res.json().catch(() => []);
    return Array.isArray(list) ? list as InspectorObjectDto[] : [];
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(list => {
        if (controller.signal.aborted || !list) return;
        setObjects(list);
        setLoadError(null);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, releaseVersionNo, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(o =>
      (o.name ?? "").toLowerCase().includes(q) || (o.sceneName ?? "").toLowerCase().includes(q));
  }, [objects, query]);
  const selected = objects.find(o => o.id === selectedId) ?? null;

  const selectObject = (id: number | null) => {
    setSelectedId(id);
    // Черновики принадлежали прошлому объекту.
    setDrafts({});
  };

  const valueOf = (p: InspectorPropertyDto) =>
    p.tag_id ? getRuntimeTagValue(p.tag_id) : getRuntimePropertyValue(p.id);
  const isBad = (p: InspectorPropertyDto) => {
    if (!p.tag_id) return false;
    const quality = getRuntimeTagQuality(p.tag_id);
    return quality !== undefined && quality !== "GOOD";
  };

  /**
   * Значение строки к записи — как в «Опциях»: у булева свойства нетронутый чекбокс — это
   * `false` (кнопка напротив строки именно его и просит), у прочих пустой ввод не пишется.
   */
  const valueToWrite = (p: InspectorPropertyDto): string | null => {
    if (isBooleanValueType(p.value_type ?? "")) return drafts[p.id] === "true" ? "true" : "false";
    const raw = drafts[p.id] ?? "";
    return raw.trim() ? raw : null;
  };

  const write = async (p: InspectorPropertyDto) => {
    if (projectId == null) return;
    const value = valueToWrite(p);
    if (value === null) return;
    if (isNumericValueType(p.value_type) && !Number.isFinite(Number(value))) {
      toast.error(`«${title(p)}»: значение должно быть числом`);
      return;
    }
    // Запись в ПЛК идёт на реальное оборудование и необратима — подтверждение, как в «Опциях».
    // Локальное свойство живёт в runtime, его подтверждать не нужно.
    if (p.tag_id) {
      const confirmed = await confirmModal({
        title: "Записать значение в ПЛК?",
        description: `Будет записано, действие необратимо: «${title(p)}» = «${value}»`,
        confirmLabel: "Записать",
        danger: true,
      });
      if (!confirmed) return;
    }

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
        if (!res.ok) throw new Error(`запись в ПЛК не прошла (${res.status})`);
        const [result] = normalizeTagWriteResults(await res.json());
        const outcome = result ? tagWriteOutcome(result) : "failed";
        if (outcome === "failed") {
          toast.error(`«${title(p)}»: ${result ? tagWriteStatusLabel(result) : "нет отчёта"}${result?.message ? ` — ${result.message}` : ""}`);
          return;
        }
        // "unknown" (NO_CONFIRMATION): команда ушла, но ПЛК не подтвердил — как в «Опциях».
        if (outcome === "unknown") {
          toast.warning(`«${title(p)}»: результат неизвестен — сверьтесь с телеметрией`);
        } else {
          toast.success("Значение записано в ПЛК");
          notifyRuntimeTagsWritten([{tagId: p.tag_id, value}]);
        }
      } else {
        const res = await fetch(`/api/runtime/projects/${projectId}/properties/write`, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({writes: [{propertyId: p.id, value}]}),
        });
        if (res.status === 409) throw new Error("проект не в эксплуатации");
        if (!res.ok) throw new Error(`не записано (${res.status})`);
        const [result] = await res.json() as PropertyWriteResultDto[];
        if (!result?.success) {
          if (result?.status === "UNKNOWN_PROPERTY") {
            // Список устарел (выпуск сменился под окном) — перечитываем.
            toast.error(`«${title(p)}»: свойства больше нет в выпуске — список обновлён`);
            setReloadKey(k => k + 1);
            return;
          }
          toast.error(result?.message || `«${title(p)}»: не записано`);
          return;
        }
        toast.success("Значение задано");
      }
      setDrafts(prev => withoutDraft(prev, p.id));
    } catch (e) {
      toast.error(`«${title(p)}»: ${e instanceof Error ? e.message : String(e)}`);
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
    // Плавающее окно (заголовок — в его шапке): высоту задаёт окно, прокручивается список.
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 mb-4 space-y-2">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Свойства любого объекта проекта. Теговые записываются в ПЛК, локальные — в runtime.
        </p>
        <input value={query} onChange={e => setQuery(e.target.value)}
               placeholder="Поиск объекта или схемы" className={inputClass} />
        <select value={selectedId ?? ""} onChange={e => selectObject(Number(e.target.value) || null)}
                className={inputClass} disabled={loading && !objects.length}>
          <option value="">{loading && !objects.length ? "Загрузка…" : "— выберите объект —"}</option>
          {filtered.map(o => (
            <option key={o.id} value={o.id}>
              {o.name ?? `#${o.id}`}{o.sceneName ? ` · ${o.sceneName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {loadError ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {loadError}
          </div>
        ) : loading && !objects.length ? (
          <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Загрузка объектов…
          </div>
        ) : !selected ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500 italic">
            {initialObjectId != null && selectedId === initialObjectId
              ? "У этого объекта нет свойств в выпуске — выберите другой"
              : "Выберите объект"}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {selected.properties.map(p => {
              const value = valueOf(p);
              const isBool = isBooleanValueType(p.value_type ?? "");
              const draft = drafts[p.id] ?? "";
              const bad = isBad(p);
              return (
                <div key={p.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    {p.tag_id
                      ? <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" aria-label="тег" />
                      : <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-400" aria-label="локальное свойство" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {title(p)}
                      </span>
                      {/* Как в «Опциях»: короткий путь тега, полный — в title; технический name
                          рядом, если подпись его скрыла. */}
                      <span
                        className="block truncate text-xs text-gray-500 dark:text-gray-400"
                        title={p.tag_id || undefined}
                      >
                        {p.label?.trim() ? `${p.name} · ` : ""}
                        {p.tag_id ? shortTagPath(p.tag_id) : "локальное свойство"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          bad ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100",
                        )}
                        title={bad ? "Значение недостоверно (качество тега не GOOD)" : undefined}
                      >
                        {value == null ? (p.tag_id ? "нет данных" : "не задано") : String(value)}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        текущее значение
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-7">
                    {isBool ? (
                      <label className="flex flex-1 items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft === "true"}
                          onChange={e => setDrafts({...drafts, [p.id]: e.target.checked ? "true" : "false"})}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        {draft === "true" ? "true" : "false"}
                      </label>
                    ) : (
                      <input
                        type={isNumericValueType(p.value_type) ? "number" : "text"}
                        value={draft}
                        onChange={e => setDrafts({...drafts, [p.id]: e.target.value})}
                        onKeyDown={e => { if (e.key === "Enter" && draft.trim()) void write(p); }}
                        placeholder="Новое значение"
                        className={cn(inputClass, "flex-1")}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => void write(p)}
                      disabled={writing !== null || (!isBool && !draft.trim())}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors",
                        p.tag_id ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500",
                        "disabled:bg-gray-400 disabled:cursor-not-allowed",
                      )}
                    >
                      {writing === p.id ? "Запись..." : p.tag_id ? "Записать в ПЛК" : "Задать"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} />
          Запись в ПЛК необратима
        </span>
        <Button onClick={onClose}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Открывает инспектор плавающим окном — схема рядом остаётся рабочей. Инспектор один: повторный
 * вызов (например, из меню другого компонента) поднимает окно и выбирает новый объект.
 * `initialObjectId` — сразу выбрать объект.
 */
export function openObjectInspectorModal(props: {initialObjectId?: number} = {}) {
  const id = "inspector";
  openFloatingWindow({
    id,
    kind: "inspector",
    title: "Инспектор объектов",
    width: 560,
    content: <ObjectInspectorContent {...props} onClose={() => closeFloatingWindow(id)} />,
  });
}
