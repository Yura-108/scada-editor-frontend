import React from "react";
import {toast} from "sonner";
import {getRuntimeSessionId, notifyRuntimeTagsWritten} from "@/core/runtime";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {describeDenial, isAccessDenial} from "@/core/access";
import {
  TagWriteRequestDto,
  TagWriteResultDto,
  normalizeTagWriteResults,
  tagWriteOutcome,
  tagWriteStatusLabel,
} from "@/core/runtime";
import {postTagWrites} from "../../api/runtimeWrite";
import {isNumericType, plural, propertyTitle, type WriteRow} from "../../lib/optionRows";

/**
 * Отправка записи «Опций» — единственный путь и для одной строки, и для «Применить для всех».
 *
 * Тело всегда массив (`writes`), даже на одну строку. Цикл одиночных запросов дал бы
 * половину записанных значений при обрыве в середине, и оператор не увидел бы, где именно
 * оборвалось; здесь исход один на весь запрос, а построчные отказы шлюза приходят отчётами.
 *
 * `onBusy` — теги, по которым идёт запись (пустой массив — запись закончена).
 */
export async function sendOptionWrites(
  rows: WriteRow[],
  projectId: number | null,
  onBusy: (tagIds: string[]) => void,
) {
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
    toast.error(`«${propertyTitle(invalid.property)}»: значение должно быть числом`);
    return;
  }

  // Без проекта бэкенд не знает, в чьих правах писать (projectId обязателен).
  if (projectId == null) {
    toast.error("Проект не выбран");
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
              «{propertyTitle(r.property)}» = «{r.value}»
            </li>
          ))}
        </ul>
      </>
    ),
    confirmLabel: "Записать",
    danger: true,
  });
  if (!confirmed) return;

  onBusy(rows.map(r => r.tagId));
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

    const res = await postTagWrites(payload, {
      // Тот же запас, что и у применения рецепта: ответ ждёт подтверждения брокера.
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Причина лежит в `message` либо в `error`, и поле зависит от того, кто ответил:
      // наш BFF на негодный запрос отдаёт `error`, а рантайм — `message` (в том числе
      // 409 «проект не назначен экземпляру» и 503 «экземпляр недоступен», у которых
      // поля `error` нет вовсе). Читать только `error` значило бы показать оператору
      // «Ошибка записи (409)» без единого слова о причине.
      // Отказ по правам (`{error: "FORBIDDEN", reason}`) — переводим, иначе вышло бы «FORBIDDEN».
      if (isAccessDenial(data)) throw new Error(describeDenial(data));
      const body = data as {message?: unknown; error?: unknown} | null;
      const raw = body?.message ?? body?.error;
      const message = typeof raw === "string" && raw ? raw : "";
      throw new Error(message || `Ошибка записи (${res.status})`);
    }

    const results = normalizeTagWriteResults(data);
    if (!results.length) throw new Error("Бэкенд не вернул отчёт о записи");

    const applied: {row: WriteRow; result: TagWriteResultDto}[] = [];
    // Исход неизвестен (`NO_CONFIRMATION`) — не успех и не отказ: команда могла
    // примениться. Считаем отдельно, иначе сводка соврала бы в обе стороны.
    const unknown: WriteRow[] = [];
    rows.forEach((row, i) => {
      // Сопоставляем ПО ИНДЕКСУ: бэкенд отвечает массивом того же размера и порядка, а
      // `tagId` в отчёте — для чтения, не для поиска (один тег может встретиться в
      // запросе дважды, и обе строки нашли бы первый отчёт). Поиск по `tagId` оставлен
      // запасным путём на случай, если размеры разъедутся.
      const result = (results.length === rows.length ? results[i] : undefined)
        ?? results.find(r => r.tagId === row.tagId);

      if (!result) {
        toast.error(`«${propertyTitle(row.property)}»: бэкенд не вернул отчёт о записи`);
        return;
      }
      const outcome = tagWriteOutcome(result);

      if (outcome === "unknown") {
        // Не отказ: команда ушла в брокер, ответа шлюза нет. Значение на схему не
        // выводим — телеметрия покажет, чем дело кончилось.
        unknown.push(row);
        toast.warning(
          `«${propertyTitle(row.property)}»: результат неизвестен — сверьтесь с телеметрией`
          + `${result.message ? ` (${result.message})` : ""}`,
        );
        return;
      }
      if (outcome === "failed") {
        // Отказ шлюза — это не сетевая ошибка: показываем его причину дословно и НЕ
        // выводим значение на схему, записи ведь не произошло.
        toast.error(
          `«${propertyTitle(row.property)}»: ${tagWriteStatusLabel(result)}${result.message ? ` — ${result.message}` : ""}`,
        );
        return;
      }

      applied.push({row, result});
    });

    // Записанное показываем сразу, не дожидаясь кадра телеметрии: у редко меняющихся
    // тегов это минуты. Но именно ПОКАЗЫВАЕМ — приоритета над телеметрией у значения
    // нет, первый же кадр по тегу его вытеснит (см. мост записи в useRuntimeEngine).
    notifyRuntimeTagsWritten(applied.map(({row}) => ({tagId: row.tagId, value: row.value})));

    if (applied.length === rows.length) {
      toast.success(rows.length === 1
        ? `«${propertyTitle(rows[0].property)}»: команда отправлена (${tagWriteStatusLabel(applied[0].result)})`
        : `Отправлено команд: ${rows.length}`);
    } else if (applied.length || unknown.length) {
      // Частичный результат обязан читаться как частичный, причём тремя числами:
      // «записано N из M» скрыло бы строки с неизвестным исходом среди отказов.
      const parts = [`записано ${applied.length}`];
      if (unknown.length) parts.push(`неизвестно ${unknown.length}`);
      const failed = rows.length - applied.length - unknown.length;
      if (failed) parts.push(`отказ ${failed}`);
      toast.warning(`Из ${rows.length}: ${parts.join(", ")} — подробности в сообщениях выше`);
    }
  } catch (err) {
    console.error(err);
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    toast.error(isTimeout
      ? "Не дождались ответа за 20 с — проверьте результат вручную, значения могли записаться"
      : (err instanceof Error ? err.message : "Ошибка записи значения"));
  } finally {
    onBusy([]);
  }
}
