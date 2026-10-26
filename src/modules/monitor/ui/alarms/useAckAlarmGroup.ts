import {toast} from "sonner";
import type {ActiveAlarm} from "../../types";
import {failedAcks, useAckAlarms} from "../../api/alarms";
import {dismissAlarms} from "../../model/alarmsStore";
// переедет в модуль вместе с движком (шаг 8)
import {getRuntimeSessionId} from "@/lib/runtime/runtimeEventBus";

/**
 * Квитирование набора аварий (группа или «Подтвердить все»).
 *
 * После ответа окно закрывается, а список НЕ правится: аварии уйдут со следующим `UPDATE`.
 * Убрать их заранее значило бы показывать, что ПЛК их снял, хотя это ещё не известно.
 */
export function useAckAlarmGroup(projectId: number) {
  const mutation = useAckAlarms();

  const ack = (alarms: readonly ActiveAlarm[]) => {
    const ackable = alarms.filter(a => a.ackable);
    if (!ackable.length || mutation.isPending) return;
    mutation.mutate({projectId, alarms: ackable, sessionId: getRuntimeSessionId()}, {
      onSuccess: results => {
        dismissAlarms(alarms);
        // Один тост на причину: десять одинаковых отказов связи — один и тот же факт.
        const messages = new Set(failedAcks(results).map(r => r.message || r.outcome));
        for (const message of messages) toast.error(`Не удалось подтвердить: ${message}`);
      },
      onError: err => toast.error(`Не удалось подтвердить: ${err.message}`),
    });
  };

  return {ack, isPending: mutation.isPending};
}
