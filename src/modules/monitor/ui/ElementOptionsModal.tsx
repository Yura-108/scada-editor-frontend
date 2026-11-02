"use client";

import React, {useState} from "react";
import {AlertTriangle, Waypoints} from "lucide-react";
import {closeFloatingWindow, openFloatingWindow} from "../model/useFloatingWindowsStore";
import {shortTagPath, isBooleanValueType, useSceneView, getSceneView} from "@/core/scene";
import {getRuntimeTagValue} from "@/core/runtime";
import {Button, ModalFooter} from "@/shared/ui/Button";
import {PropertyCreateDto} from "@/core/scene";
import {useOpenScene} from "@/core/project";
import {useLiveValueTick} from "../model/useLiveValueTick";
import {sendOptionWrites} from "../model/options/sendOptionWrites";
import {isNumericType, propertyTitle, type WriteRow} from "../lib/optionRows";
import {ValueWriteRow} from "./ValueWriteRow";

interface Props {
  elementKey: string;
}

interface ContentProps extends Props {
  /** Закрыть именно это плавающее окно. */
  onClose: () => void;
}

function ElementOptionsContent({elementKey, onClose}: ContentProps) {
  const element = useSceneView((s) => s.elements.find(el => el.key === elementKey));
  const projectId = useOpenScene((s) => s.currentProject?.id ?? null);

  const tagProps = (element?.properties ?? []).filter(p => p.property_type === "Тег");

  // Черновики ввода по tag_id: правка одной строки не должна трогать соседние.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Теги, по которым сейчас идёт запись. Массив, а не один ключ: «Применить для всех»
  // занимает сразу несколько строк, и спиннер должен стоять у каждой.
  const [writingTags, setWritingTags] = useState<string[]>([]);
  const isBusy = writingTags.length > 0;
  useLiveValueTick();

  const asText = (v: string | null | undefined) => (v == null ? "нет данных" : String(v));
  /** То же значение, что нарисовано на холсте: движок держит их в рефах, а не в сторе. */
  const shownValueOf = (tagId: string) => asText(getRuntimeTagValue(tagId));

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

  const sendWrites = (rows: WriteRow[]) => sendOptionWrites(rows, projectId, setWritingTags);

  /** Кнопка напротив строки: та же отправка, массивом из одного элемента. */
  const write = (property: PropertyCreateDto) => {
    const row = rowOf(property, false);
    if (row) void sendWrites([row]);
  };

  return (
    // Плавающее окно (заголовок — в его шапке): высоту задаёт окно, прокручивается список.
    <div className="flex flex-col flex-1 min-h-0">
      <p className="shrink-0 mb-4 text-gray-500 dark:text-gray-400 text-sm">
        Значения привязанных тегов. Записанное показывается, пока контроллер не пришлёт
        следующее.
      </p>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {tagProps.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 italic">
            У компонента нет свойств, привязанных к тегам
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {tagProps.map((p) => {
              const tagId = p.tag_id ?? "";
              const isBool = isBooleanValueType(p.value_type);
              const draft = drafts[tagId] ?? "";
              const isWriting = writingTags.includes(tagId);

              return (
                <div key={p.id ?? p.name} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {propertyTitle(p)}
                      </span>
                      {/* Полный путь — в title: подпись короткая, но узел проверить можно.
                          Технический name — рядом, если подпись его скрыла: он нужен при
                          отладке скриптов. */}
                      <span
                        className="block truncate text-xs text-gray-500 dark:text-gray-400"
                        title={tagId || undefined}
                      >
                        {p.label?.trim() ? `${p.name} · ` : ""}
                        {tagId ? shortTagPath(tagId) : "тег не назначен"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {shownValueOf(tagId)}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        текущее значение
                      </span>
                    </span>
                  </div>

                  <ValueWriteRow
                    isBool={isBool}
                    numeric={isNumericType(p.value_type)}
                    draft={draft}
                    onDraft={(value) => setDrafts({...drafts, [tagId]: value})}
                    onWrite={() => write(p)}
                    disabled={!tagId || isBusy || (!isBool && !draft.trim())}
                    label={isWriting ? "Запись..." : "Записать в ПЛК"}
                    danger
                  />
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
        <Button onClick={onClose}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Открывает «Опции» компонента из меню монитора — плавающим окном, а не модалкой: оператор
 * держит его открытым и продолжает смотреть и нажимать схему. Окно на компонент одно —
 * повторный вызов поднимает его наверх; «Опции» разных компонентов открываются рядом.
 */
export function openElementOptionsModal(props: Props) {
  const id = `options:${props.elementKey}`;
  const element = getSceneView().elements.find(el => el.key === props.elementKey);
  openFloatingWindow({
    id,
    kind: "options",
    title: `Опции · ${element?.label || element?.type || "компонент"}`,
    width: 480,
    content: <ElementOptionsContent {...props} onClose={() => closeFloatingWindow(id)} />,
  });
}
