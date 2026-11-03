"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/** Подписка-заглушка: признак «смонтирован» не меняется после первого клиентского рендера. */
const subscribeNothing = () => () => {};

export function ThemeToggle() {
  // Именно resolvedTheme: при defaultTheme="system" поле theme равно "system",
  // из-за чего первый клик мог не изменить вид, а иконка показывала Moon даже
  // когда система уже тёмная.
  const { resolvedTheme, setTheme } = useTheme();
  // Тема известна только в браузере: на сервере и при гидратации — пустая кнопка того же
  // размера (снимок сервера false), сразу после — настоящая. Иначе иконка разошлась бы с
  // серверной разметкой.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  if (!mounted) return <button className="p-2 w-9 h-9" aria-hidden />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}



