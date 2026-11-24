import {useState} from "react";
import {toast} from "sonner";
import {isBooleanValueType, isNumericValueType} from "@/core/scene";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {
  getRuntimeSessionId, notifyRuntimeTagsWritten,
  InspectorPropertyDto, PropertyWriteResultDto, TagWriteRequestDto,
  normalizeTagWriteResults, tagWriteOutcome, tagWriteStatusLabel,
} from "@/core/runtime";
import {errorTextFromJson} from "@/core/access";
import {useOpenScene} from "@/core/project";
import {postPropertyWrites, postTagWrites} from "../../api/runtimeWrite";
import {inspectorTitle as title, withoutDraft} from "../../lib/inspectorProps";

/**
 * Черновики и запись инспектора: теговое — в ПЛК (`tags/write`), как «Опции»; локальное —
 * `properties/write`. Записанное локально не подставляем: UPDATE приходит за десятки
 * миллисекунд, и только он гарантирует, что окно показывает то, что лежит в runtime.
 *
 * `onStale` — бэк ответил UNKNOWN_PROPERTY: список объектов устарел, его надо перечитать.
 */
export function useInspectorWrite(onStale: () => void) {
  const projectId = useOpenScene((s) => s.currentProject?.id ?? null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [writing, setWriting] = useState<number | null>(null);

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
        const res = await postTagWrites(body);
        if (!res.ok) throw new Error(errorTextFromJson(res.status, await res.json().catch(() => null), `запись в ПЛК не прошла (${res.status})`));
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
        const res = await postPropertyWrites(projectId, [{propertyId: p.id, value}]);
        if (res.status === 409) throw new Error("проект не в эксплуатации");
        if (!res.ok) throw new Error(errorTextFromJson(res.status, await res.json().catch(() => null), `не записано (${res.status})`));
        const [result] = await res.json() as PropertyWriteResultDto[];
        if (!result?.success) {
          if (result?.status === "UNKNOWN_PROPERTY") {
            // Список устарел (выпуск сменился под окном) — перечитываем.
            toast.error(`«${title(p)}»: свойства больше нет в выпуске — список обновлён`);
            onStale();
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

  /** Правка черновика одного свойства. */
  const setDraft = (id: number, value: string) => setDrafts({...drafts, [id]: value});
  /** Черновики принадлежат выбранному объекту — при смене объекта снимаются. */
  const clearDrafts = () => setDrafts({});

  return {drafts, setDraft, clearDrafts, writing, write};
}
