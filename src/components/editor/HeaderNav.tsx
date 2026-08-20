"use client";

import React, {useState} from "react";
import Link from "next/link";
import {cn} from "@/lib/utils";
import {Activity, HashIcon, Layout, Menu, Scroll, X} from "lucide-react";
import {usePathname} from "next/navigation";

const navItems = [
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
    name: "База каналов",
    href: "/channels",
    icon: HashIcon,
  },
  {
    name: "Логирование",
    href: "/log",
    icon: Scroll,
  }
];

/**
 * Раздел считается активным и на вложенных маршрутах: точное сравнение
 * `pathname === href` не подсвечивало ни `/channels/123`, ни любой другой
 * вложенный путь.
 */
const isSectionActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function HeaderNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
    <nav className="hidden md:flex items-center gap-1" aria-label="Основная навигация">
      {navItems.map((item, index) => {
        const isActive = isSectionActive(pathname, item.href);

        return (
          <React.Fragment key={item.href + index}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                "active:scale-95",
                isActive
                  ? "text-gray-900 dark:text-white bg-gray-900/5 dark:bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  // Было "hover:text-gray-900 dark:text-white": tailwind-merge оставлял
                  // последний dark:text-*, поэтому в тёмной теме неактивный пункт всегда
                  // был белым и не отличался от активного.
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/5 dark:hover:bg-white/5"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-indigo-400" : "text-current"
              )} />
              {item.name}
            </Link>

            {index < navItems.length - 1 && (
              <div className="w-px h-4 bg-gray-100 dark:bg-gray-800 mx-2" />
            )}
          </React.Fragment>
        )
      })}
    </nav>

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

