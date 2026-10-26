import {useMutation} from "@tanstack/react-query";
import type {ActiveAlarm, AlarmAckResult} from "../types";
import {ACK_BATCH_LIMIT, chunk} from "../lib/alarms";
// переедут в core/access вместе с правами (шаг 8)
import {errorTextFromJson} from "@/lib/access/accessErrors";

/** Исходы, о которых оператору говорить нечего: авария подтверждена или её уже нет. */
const QUIET_OUTCOMES = new Set(["APPLIED", "NOT_FOUND", "NOT_ACKABLE"]);

/** Исходы, которые надо показать оператору: квитирование до ПЛК не дошло. */
export const failedAcks = (results: readonly AlarmAckResult[]): AlarmAckResult[] =>
  results.filter(r => !QUIET_OUTCOMES.has(r.outcome));

/**
 * Квитирование (`POST /api/runtime/projects/{id}/alarms/ack`), не больше 100 аварий за запрос.
 * Ошибка запроса целиком (403 — нет права управления, 409 — проект не в эксплуатации) — исключение
 * с текстом для оператора.
 */
export async function ackAlarms(
  projectId: number,
  alarms: readonly ActiveAlarm[],
  sessionId: string | null,
): Promise<AlarmAckResult[]> {
  const results: AlarmAckResult[] = [];
  for (const part of chunk(alarms, ACK_BATCH_LIMIT)) {
    const res = await fetch(`/api/runtime/projects/${projectId}/alarms/ack`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        alarms: part.map(({controllerId, key}) => ({controllerId, key})),
        ...(sessionId ? {sessionId} : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const fallback = res.status === 409 ? "Проект не в эксплуатации" : `Ошибка подтверждения (${res.status})`;
      throw new Error(errorTextFromJson(res.status, data, fallback));
    }
    if (Array.isArray(data)) results.push(...(data as AlarmAckResult[]));
  }
  return results;
}

export function useAckAlarms() {
  return useMutation({
    mutationFn: ({projectId, alarms, sessionId}: {
      projectId: number;
      alarms: readonly ActiveAlarm[];
      sessionId: string | null;
    }) => ackAlarms(projectId, alarms, sessionId),
  });
}
