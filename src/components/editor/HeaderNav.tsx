"use client";

import {useState} from "react";
import Link from "next/link";
import {cn} from "@/lib/utils";
import {Activity, ClipboardList, Cpu, Database, HashIcon, Layout, Menu, Scroll, ShieldCheck, X} from "lucide-react";
import {usePathname} from "next/navigation";
import {Tooltip} from "radix-ui";

const baseNavItems = [
  {
    name: "Редактор схем",
    href: "/editor",
    icon: Layout,
  },
  {
    name: "Монитор",
    href: "/monitor",
    icon: Activity,
  },
  {
    name: "Автоматизация",
    href: "/automation",
    icon: Cpu,
  },
  {
    name: "Данные проекта",
    href: "/data",
    icon: Database,
  },
  {
    name: "База каналов",
    href: "/channels",
    icon: HashIcon,
  },
  {
    name: "Логирование",
    href: "/log",
    icon: Scroll,
  },
  {
    name: "Журнал действий",
    href: "/actions",
    icon: ClipboardList,
  },
];

/** Только администратору (claim `admin` из токена); сама страница проверяет это ещё раз. */
const adminItem = {
  name: "Администрирование",
  href: "/admin",
  icon: ShieldCheck,
};

/**
 * Раздел считается активным и на вложенных маршрутах: точное сравнение
 * `pathname === href` не подсвечивало ни `/channels/123`, ни любой другой
 * вложенный путь.
 */
const isSectionActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function HeaderNav({isAdmin = false}: {isAdmin?: boolean}) {
  const pathname = usePathname();
  const navItems = isAdmin ? [...baseNavItems, adminItem] : baseNavItems;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
    {/* Только иконки: разделов уже 8, и с подписями они не помещались даже на широком
        экране. Название — во всплывающей подсказке (наведение и фокус с клавиатуры), активный
        раздел выделен фоном и цветом иконки. Ниже md — гамбургер (ниже). */}
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <nav
        className="hidden md:flex min-w-0 flex-1 items-center justify-center gap-1"
        aria-label="Основная навигация"
      >
        {navItems.map(item => {
          const isActive = isSectionActive(pathname, item.href);

          return (
            <Tooltip.Root key={item.href}>
              <Tooltip.Trigger asChild>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  // Подписи нет — имя ссылки для скринридеров даём явно.
                  aria-label={item.name}
                  className={cn(
                    "flex shrink-0 items-center justify-center p-2.5 rounded-xl transition-all duration-200",
                    "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
                    isActive
                      ? "text-gray-900 dark:text-white bg-gray-900/5 dark:bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                      // Было "hover:text-gray-900 dark:text-white": tailwind-merge оставлял
                      // последний dark:text-*, поэтому в тёмной теме неактивный пункт всегда
                      // был белым и не отличался от активного.
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/5 dark:hover:bg-white/5"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive ? "text-indigo-400" : "text-current"
                  )} />
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={6}
                  className="z-dropdown rounded-md bg-gray-900 dark:bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-white dark:text-gray-900 shadow-lg select-none"
                >
                  {item.name}
                  <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </nav>
    </Tooltip.Provider>

    {/* Мобильная навигация: раньше меню было просто `hidden md:flex`, то есть на
        узком экране разделы приложения оказывались недостижимы вовсе. */}
    <div className="md:hidden relative">
      <button
        type="button"
        onClick={() => setMobileOpen(o => !o)}
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav"
        aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
        title={mobileOpen ? "Закрыть меню" : "Открыть меню"}
        className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Основная навигация"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-dropdown min-w-52 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-2xl"
        >
          {navItems.map(item => {
            const isActive = isSectionActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                // Переход по ссылке закрывает меню.
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "text-gray-900 dark:text-white bg-gray-900/5 dark:bg-white/10"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-900/5 dark:hover:bg-white/5",
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "text-current")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
    </>
  )
}

