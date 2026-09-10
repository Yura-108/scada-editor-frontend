/** Секундомер шага, `мм:сс`. Общий для панели процедур и HUD над схемой. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Как часто перерисовывать секундомер. Он считается от `stepStartedAt`, а не хранится. */
export const CLOCK_TICK_MS = 500;
