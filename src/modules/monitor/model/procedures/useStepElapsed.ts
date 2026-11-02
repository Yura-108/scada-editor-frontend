import {useEffect, useState} from "react";
import {CLOCK_TICK_MS} from "./procedureFormat";

/**
 * Секундомер шага. Держим готовое число, а не считаем `Date.now()` в теле рендера:
 * рендер обязан быть чистым (`react-hooks/purity`), а тик и так нужен для перерисовки.
 */
export function useStepElapsed(stepStartedAt: number | null | undefined) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(stepStartedAt != null ? Date.now() - stepStartedAt : 0);
    tick();
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [stepStartedAt]);

  return elapsed;
}
