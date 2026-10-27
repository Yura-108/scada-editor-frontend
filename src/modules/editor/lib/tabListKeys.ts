/**
 * Клавиатурная навигация внутри полосы вкладок (`role="tablist"`).
 *
 * Общий для полосы схем (`SceneTabs`) и левого таблиста «Палитра/Слои» в `WorkSpace`:
 * дублировать этот дженерик в двух местах значит однажды починить стрелки только в одном.
 */
export const handleTabListKey = <T extends string>(
  e: React.KeyboardEvent<HTMLButtonElement>,
  tabs: readonly T[],
  current: T,
  setTab: (t: T) => void,
) => {
  const idx = tabs.indexOf(current);
  let next = -1;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % tabs.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tabs.length - 1;
  if (next < 0) return;

  e.preventDefault();
  setTab(tabs[next]);
  // Именно closest('[role="tablist"]'), а не parentElement: у вкладки схемы есть
  // обёртка с кнопкой открепления, и родитель кнопки — уже не полоса вкладок.
  e.currentTarget.closest('[role="tablist"]')
    ?.querySelectorAll<HTMLElement>('[role="tab"]')[next]
    ?.focus();
};
