/**
 * Откуда `getRenderedElement` берёт активное состояние элементов (`elementKey` → id состояния).
 *
 * Карта живёт в сторе редактора (`currentComponentStateByElementKey`) — общем для редактора
 * и монитора. `core` не знает модулей, поэтому стор регистрирует чтение сам, сразу после
 * создания (`bindActiveStateReader`), — тот же приём, что у `bindEditorStore`. Расчёты,
 * которым нужна карта, вызываются только во время работы, когда стор уже создан.
 */
type ActiveStateReader = () => Record<string, string>;

let reader: ActiveStateReader | null = null;

export const bindActiveStateReader = (read: ActiveStateReader) => {
  reader = read;
};

export const readActiveStates = (): Record<string, string> => {
  if (!reader) throw new Error("useEditorStore ещё не создан: bindActiveStateReader не вызывался");
  return reader();
};
