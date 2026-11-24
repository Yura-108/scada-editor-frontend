import {useEffect, useState} from "react";

/** Как часто перечитываем живые значения, пока окно открыто. */
const VALUE_POLL_MS = 1000;

/**
 * Перерисовка окна раз в секунду. Живые значения лежат в рефах движка, а не в сторе,
 * поэтому подписаться на них селектором нельзя — опрашиваем.
 */
export function useLiveValueTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), VALUE_POLL_MS);
    return () => clearInterval(id);
  }, []);
}
