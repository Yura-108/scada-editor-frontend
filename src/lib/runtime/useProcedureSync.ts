"use client";

import {useEffect} from "react";
import {toast} from "sonner";
import {useProcedureStore} from "@/store/useProcedureStore";
import {useEditorStore} from "@/store/useEditorStore";
import {fetchProcedureStatus, NoActiveProcedureError} from "@/lib/runtime/procedures";

/**
 * Фоновая часть процедуры: сверка состояния и уведомления об отказах.
 *
 * **Монтируется ровно один раз** — в `MonitorClient`. Состояние процедуры показывают двое
 * (панель «Процедуры» и HUD над схемой), и повтори каждый из них эти эффекты, вышло бы два
 * опроса `GET /status` и по два тоста на каждое событие.
 */

/**
 * Сверка со `/status`. Редкая намеренно: ход процедуры приезжает событиями по WS, состояние
 * при подключении — кадром `SNAPSHOT`, а секундомер тикает на клиенте. Сеть нужна лишь чтобы
 * поймать пропущенный кадр.
 */
const STATUS_POLL_MS = 5000;

export function useProcedureSync(): void {
  const recipeId = useProcedureStore(s => s.recipeId);
  const lastAlert = useProcedureStore(s => s.lastAlert);
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);

  /**
   * Отказ записи внутри шага виден ТОЛЬКО этим каналом: запись из `action` идёт
   * fire-and-forget, и без события оператор не узнал бы о ней ничего.
   */
  useEffect(() => {
    if (!lastAlert) return;
    const text = lastAlert.message
      ?? (lastAlert.kind === "STALLED" ? "Шаг долго не завершается" : "Отказ записи");
    if (lastAlert.kind === "WRITE_FAILED") toast.error(`Запись не прошла: ${text}`);
    else toast.warning(text);
    useProcedureStore.getState().clearAlert();
  }, [lastAlert]);

  useEffect(() => {
    if (!recipeId || projectId == null) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const next = await fetchProcedureStatus(recipeId, projectId);
        if (!cancelled) useProcedureStore.getState().setStatus(next);
      } catch (err) {
        if (cancelled) return;
        // 400 — процедуру просто не запускали. Раньше это означало «рантайм потерял
        // состояние» и вело к подсказке `resume-guess`; теперь состояние хранится в базе
        // и восстанавливается точно, поэтому единственный честный вывод — показать,
        // что процедура не идёт.
        if (err instanceof NoActiveProcedureError) {
          useProcedureStore.getState().adoptStatuses([]);
          return;
        }
        // Остальное (сеть, 500) глотаем молча: состояние соединения оператор видит
        // по индикатору WS, а тост раз в пять секунд был бы шумом.
      }
    };

    void sync();
    const id = setInterval(() => void sync(), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recipeId, projectId]);
}
