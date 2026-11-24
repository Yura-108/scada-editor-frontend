import {useState} from "react";
import {isBooleanValueType, type PropertyCreateDto} from "@/core/scene";
import {type WriteRow} from "../../lib/optionRows";
import {sendOptionWrites} from "./sendOptionWrites";

/**
 * Черновики «Опций» и запись: значения по `tag_id`, теги в записи, строки для
 * «Применить для всех» и запись одной строки.
 */
export function useOptionDrafts(tagProps: PropertyCreateDto[], projectId: number | null) {
  // Черновики ввода по tag_id: правка одной строки не должна трогать соседние.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Теги, по которым сейчас идёт запись. Массив, а не один ключ: «Применить для всех»
  // занимает сразу несколько строк, и спиннер должен стоять у каждой.
  const [writingTags, setWritingTags] = useState<string[]>([]);
  const isBusy = writingTags.length > 0;

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

  /** Правка черновика одной строки. */
  const setDraft = (tagId: string, value: string) => setDrafts({...drafts, [tagId]: value});

  return {drafts, setDraft, writingTags, isBusy, filledRows, sendWrites, write};
}
