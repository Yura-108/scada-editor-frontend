"use client";

import React, {useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle, RotateCcw, Waypoints} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {shortTagPath} from "@/lib/editor/tagPath";
import {isBooleanValueType} from "@/lib/editor/valueTypes";
import {getRuntimeLiveTagValue, getRuntimeSessionId, getRuntimeTagValue} from "@/lib/runtime/runtimeEventBus";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {Button, ModalFooter} from "@/components/ui/Button";
import {PropertyCreateDto} from "@/types/tags.types";
import {TagWriteResultDto, tagWriteStatusLabel} from "@/types/runtimeWrite.types";

interface Props {
  elementKey: string;
}

/** Как часто перечитываем живые значения, пока окно открыто. */
const VALUE_POLL_MS = 1000;

const isNumericType = (valueType?: string) => {
  const t = (valueType ?? "").toLowerCase();
  return t === "integer" || t === "float" || t === "int" || t === "double";
};

function ElementOptionsContent({elementKey}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const element = useEditorStore((s) => s.elements.find(el => el.key === elementKey));
  const projectId = useEditorStore((s) => s.currentProject?.id ?? null);
  const manualTagValues = useEditorStore((s) => s.manualTagValues);
  const setManualTagValue = useEditorStore((s) => s.setManualTagValue);
  const clearManualTagValue = useEditorStore((s) => s.clearManualTagValue);

  const tagProps = (element?.properties ?? []).filter(p => p.property_type === "Тег");

  // Черновики ввода по tag_id: правка одной строки не должна трогать соседние.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [writingTag, setWritingTag] = useState<string | null>(null);
  // Тик перечитывания живых значений: они лежат в рефах движка, а не в сторе,
  // поэтому подписаться на них селектором нельзя — опрашиваем раз в секунду.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), VALUE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const asText = (v: string | null | undefined) => (v == null ? "нет данных" : String(v));
  /** То, что видит схема (под подменой — само ручное значение). */
  const shownValueOf = (tagId: string) => asText(getRuntimeTagValue(tagId));
  /** То, что реально приходит с контроллера, даже когда сверху лежит подмена. */
  const liveValueOf = (tagId: string) => asText(getRuntimeLiveTagValue(tagId));

  const write = async (property: PropertyCreateDto) => {
    const tagId = property.tag_id;
    if (!tagId) return;

    const sessionId = getRuntimeSessionId();
    if (!sessionId) {
      toast.error("Нет активной сессии монитора");
      return;
    }

    // У булева тега нетронутый чекбокс — это `false`, а не пустая строка: иначе
    // «записать false» отправляло бы в контроллер пустое значение.
    const raw = isBooleanValueType(property.value_type)
      ? (drafts[tagId] === "true" ? "true" : "false")
      : (drafts[tagId] ?? "");
    if (isNumericType(property.value_type) && !Number.isFinite(Number(raw))) {
      toast.error(`«${property.name}»: значение должно быть числом`);
      return;
    }

    // Запись идёт на реальное оборудование и необратима — подтверждение обязательно
    // (тот же порядок, что у применения рецепта).
    const confirmed = await confirmModal({
      title: "Записать значение в ПЛК?",
      description: `Параметру «${property.name}» будет записано значение «${raw}». Действие необратимо.`,
      confirmLabel: "Записать",
      danger: true,
    });
    if (!confirmed) return;

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

      if (!result.success) {
        // Отказ шлюза — это не сетевая ошибка: показываем его причину дословно и
        // НЕ подменяем значение на экране, записи ведь не произошло.
        toast.error(`${tagWriteStatusLabel(result)}${result.message ? `: ${result.message}` : ""}`);
        return;
      }

      // Значение остаётся на экране до явной отмены оператором.
      setManualTagValue(tagId, raw);
      toast.success(`«${property.name}»: команда отправлена (${tagWriteStatusLabel(result)})`);
    } catch (err) {
      console.error(err);
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      toast.error(isTimeout
        ? "Не дождались ответа за 20 с — проверьте результат вручную, значение могло записаться"
        : (err instanceof Error ? err.message : "Ошибка записи значения"));
    } finally {
      setWritingTag(null);
    }
  };

  const inputClass = cn(
    "w-full rounded-lg border bg-white dark:bg-neutral-900",
    "border-neutral-300 dark:border-neutral-700",
    "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
    "outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Опции · {element?.label || element?.type || "компонент"}
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Значения привязанных тегов. Записанное значение остаётся на экране, пока его не
          вернут к живому.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {tagProps.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 italic">
            У компонента нет свойств, привязанных к тегам
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {tagProps.map((p) => {
              const tagId = p.tag_id ?? "";
              const manual = tagId ? manualTagValues[tagId] : undefined;
              const isManual = manual !== undefined;
              const isBool = isBooleanValueType(p.value_type);
              const draft = drafts[tagId] ?? "";
              const isWriting = writingTag === tagId;

              return (
                <div key={p.id ?? p.name} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {p.name}
                      </span>
                      {/* Полный путь — в title: подпись короткая, но узел проверить можно. */}
                      <span
                        className="block truncate text-xs text-gray-500 dark:text-gray-400"
                        title={tagId || undefined}
                      >
                        {tagId ? shortTagPath(tagId) : "тег не назначен"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {isManual ? manual : shownValueOf(tagId)}
                      </span>
                      {/* Под подменой показываем ещё и живое значение: подмена, за которой
                          не видно данных контроллера, — это способ проглядеть аварию. */}
                      <span className={cn(
                        "block text-xs",
                        isManual
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-500 dark:text-gray-400",
                      )}>
                        {isManual ? `ручное · с контроллера: ${liveValueOf(tagId)}` : "живое значение"}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-7">
                    {isBool ? (
                      <label className="flex flex-1 items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft === "true"}
                          onChange={(e) => setDrafts({...drafts, [tagId]: e.target.checked ? "true" : "false"})}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        {draft === "true" ? "true" : "false"}
                      </label>
                    ) : (
                      <input
                        type={isNumericType(p.value_type) ? "number" : "text"}
                        value={draft}
                        onChange={(e) => setDrafts({...drafts, [tagId]: e.target.value})}
                        placeholder="Новое значение"
                        className={cn(inputClass, "flex-1")}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => void write(p)}
                      disabled={!tagId || isWriting || (!isBool && !draft.trim())}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors",
                        "bg-red-600 hover:bg-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed",
                      )}
                    >
                      {isWriting ? "Запись..." : "Записать в ПЛК"}
                    </button>

                    {isManual && (
                      <button
                        type="button"
                        title="Вернуть живое значение"
                        onClick={() => clearManualTagValue(tagId)}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <RotateCcw size={14} />
                        Вернуть живое
                      </button>
                    )}
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
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/** Открывает «Опции» компонента из меню монитора. */
export function openElementOptionsModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<ElementOptionsContent {...props} />);
}
