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
import {
  TagWriteRequestDto,
  TagWriteResultDto,
  normalizeTagWriteResults,
  tagWriteStatusLabel,
} from "@/types/runtimeWrite.types";

interface Props {
  elementKey: string;
}

/** Как часто перечитываем живые значения, пока окно открыто. */
const VALUE_POLL_MS = 1000;

const isNumericType = (valueType?: string) => {
  const t = (valueType ?? "").toLowerCase();
  return t === "integer" || t === "float" || t === "int" || t === "double";
};

/** Строка к записи: свойство, адрес тега и значение, которое уедет в ПЛК. */
interface WriteRow {
  property: PropertyCreateDto;
  tagId: string;
  value: string;
}

/** «1 значение» / «2 значения» / «5 значений» — для заголовка подтверждения. */
const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
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
  // Теги, по которым сейчас идёт запись. Массив, а не один ключ: «Применить для всех»
  // занимает сразу несколько строк, и спиннер должен стоять у каждой.
  const [writingTags, setWritingTags] = useState<string[]>([]);
  const isBusy = writingTags.length > 0;
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

  /**
   * Значение строки для записи.
   *
   * `requireTouched` — вся разница между кнопкой строки и «Применить для всех». У булева тега
   * нетронутый чекбокс это `false`, а не пустая строка: нажав «Записать в ПЛК» напротив строки,
   * оператор именно этого и просит. А вот «для всех» так трактовать нельзя — иначе одна кнопка
   * разослала бы `false` во все булевы теги компонента, которых оператор не касался.
   */
  const rowOf = (property: PropertyCreateDto, requireTouched: boolean): WriteRow | null => {
    const tagId = property.tag_id;
    if (!tagId) return null;

    const touched = drafts[tagId] !== undefined;
    if (requireTouched && !touched) return null;

    if (isBooleanValueType(property.value_type)) {
      return {property, tagId, value: drafts[tagId] === "true" ? "true" : "false"};
    }

    const raw = drafts[tagId] ?? "";
    if (!raw.trim()) return null;
    return {property, tagId, value: raw};
  };

  /**
   * Что уедет по «Применить для всех»: строки с назначенным тегом и заданным значением.
   *
   * Одинаковые теги схлопываются. Два свойства компонента могут смотреть на один тег, а
   * черновики ключуются по `tag_id` — значит и значение у них общее, и вторая строка была бы
   * дублем той же записи. Отправлять его нельзя: один адрес дважды в запросе — это гонка на
   * стороне шлюза, и BFF такой запрос отвергает.
   */
  const filledRows = tagProps
    .map(p => rowOf(p, true))
    .filter((r): r is WriteRow => r !== null)
    .filter((r, i, all) => all.findIndex(x => x.tagId === r.tagId) === i);

  /**
   * Отправка записи — единственный путь и для одной строки, и для «Применить для всех».
   *
   * Тело всегда массив (`writes`), даже на одну строку. Цикл одиночных запросов дал бы
   * половину записанных значений при обрыве в середине, и оператор не увидел бы, где именно
   * оборвалось; здесь исход один на весь запрос, а построчные отказы шлюза приходят отчётами.
   */
  const sendWrites = async (rows: WriteRow[]) => {
    if (!rows.length) return;

    // Сессия НЕ обязательна: по контракту записи она нужна бэкенду только для контекста и
    // логов, тег адресуется напрямую по `tagId`. Отказывать из-за оборвавшейся сессии,
    // когда оператор уже подтвердил запись, было бы отказом на пустом месте — в «Опции»
    // без связи всё равно не войти, пункт меню там заблокирован.
    const sessionId = getRuntimeSessionId() ?? undefined;

    const invalid = rows.find(
      r => isNumericType(r.property.value_type) && !Number.isFinite(Number(r.value)),
    );
    if (invalid) {
      // Отправлять остальные строки без нечисловой не начинаем: оператор задавал набор
      // значений целиком, и частичный набор в ПЛК — не то, о чём он просил.
      toast.error(`«${invalid.property.name}»: значение должно быть числом`);
      return;
    }

    // Запись идёт на реальное оборудование и необратима — подтверждение обязательно
    // (тот же порядок, что у применения рецепта). Перечисляем ВСЕ строки поимённо:
    // «применить для всех» вслепую — это способ записать в ПЛК то, о чём уже забыли.
    const confirmed = await confirmModal({
      title: rows.length === 1
        ? "Записать значение в ПЛК?"
        : `Записать ${rows.length} ${plural(rows.length, "значение", "значения", "значений")} в ПЛК?`,
      description: (
        <>
          <span>Будет записано, действие необратимо:</span>
          <ul className="mt-2 space-y-1">
            {rows.map(r => (
              <li key={r.tagId}>
                «{r.property.name}» = «{r.value}»
              </li>
            ))}
          </ul>
        </>
      ),
      confirmLabel: "Записать",
      danger: true,
    });
    if (!confirmed) return;

    setWritingTags(rows.map(r => r.tagId));
    try {
      const payload: TagWriteRequestDto = {
        // `valueType` — тип значения свойства: по нему бэкенд приводит строку к типу канала.
        // Без него булево значение уехало бы в контроллер строкой и могло лечь неверной
        // уставкой (контракт записи от 08.09.2026).
        writes: rows.map(r => ({
          tagId: r.tagId,
          value: r.value,
          valueType: r.property.value_type,
        })),
        sessionId,
        projectId,
      };

      const res = await fetch("/api/runtime/tags/write", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        // Тот же запас, что и у применения рецепта: ответ ждёт подтверждения брокера.
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = (data as {error?: string} | null)?.error;
        throw new Error(message || `Ошибка записи (${res.status})`);
      }

      const results = normalizeTagWriteResults(data);
      if (!results.length) throw new Error("Бэкенд не вернул отчёт о записи");

      const applied: {row: WriteRow; result: TagWriteResultDto}[] = [];
      rows.forEach((row, i) => {
        // Сопоставляем ПО ИНДЕКСУ: бэкенд отвечает массивом того же размера и порядка, а
        // `tagId` в отчёте — для чтения, не для поиска (один тег может встретиться в
        // запросе дважды, и обе строки нашли бы первый отчёт). Поиск по `tagId` оставлен
        // запасным путём на случай, если размеры разъедутся.
        const result = (results.length === rows.length ? results[i] : undefined)
          ?? results.find(r => r.tagId === row.tagId);

        if (!result) {
          toast.error(`«${row.property.name}»: бэкенд не вернул отчёт о записи`);
          return;
        }
        if (!result.success) {
          // Отказ шлюза — это не сетевая ошибка: показываем его причину дословно и
          // НЕ подменяем значение на экране, записи ведь не произошло.
          toast.error(
            `«${row.property.name}»: ${tagWriteStatusLabel(result)}${result.message ? ` — ${result.message}` : ""}`,
          );
          return;
        }

        // Значение остаётся на экране до явной отмены оператором.
        setManualTagValue(row.tagId, row.value);
        applied.push({row, result});
      });

      if (applied.length === rows.length) {
        toast.success(rows.length === 1
          ? `«${rows[0].property.name}»: команда отправлена (${tagWriteStatusLabel(applied[0].result)})`
          : `Отправлено команд: ${rows.length}`);
      } else if (applied.length) {
        // Частичный успех обязан читаться как частичный: остальные теги остались с прежним
        // значением на контроллере, и оператор должен знать, что дописывать.
        toast.warning(`Записано ${applied.length} из ${rows.length} — по остальным см. сообщения об ошибках`);
      }
    } catch (err) {
      console.error(err);
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      toast.error(isTimeout
        ? "Не дождались ответа за 20 с — проверьте результат вручную, значения могли записаться"
        : (err instanceof Error ? err.message : "Ошибка записи значения"));
    } finally {
      setWritingTags([]);
    }
  };

  /** Кнопка напротив строки: та же отправка, массивом из одного элемента. */
  const write = (property: PropertyCreateDto) => {
    const row = rowOf(property, false);
    if (row) void sendWrites([row]);
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
              const isWriting = writingTags.includes(tagId);

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
                      onClick={() => write(p)}
                      disabled={!tagId || isBusy || (!isBool && !draft.trim())}
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
        {/* Пакетная запись. Одна строка обходится кнопкой в самой строке, поэтому кнопка
            появляется только там, где есть что объединять. */}
        {tagProps.length > 1 && (
          <Button
            variant="danger"
            onClick={() => void sendWrites(filledRows)}
            disabled={isBusy || !filledRows.length}
            title={filledRows.length
              ? "Записать все заданные значения одним запросом"
              : "Задайте значение хотя бы у одной строки"}
          >
            {isBusy
              ? "Запись..."
              : `Применить для всех${filledRows.length ? ` (${filledRows.length})` : ""}`}
          </Button>
        )}
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
