"use client";

import {useLayoutEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter, usePathname} from "next/navigation";
import {cn} from "@/shared/lib/cn";
import {Menu, X} from "lucide-react";
import {Tooltip} from "radix-ui";
import {adminItem, baseNavItems, isSectionActive, type NavItem} from "@/components/editor/navItems";
import {guardedClick} from "@/lib/unsavedGuard";

const linkBase = cn(
  "flex shrink-0 items-center justify-center gap-2 rounded-xl transition-all duration-200 whitespace-nowrap",
  "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
);
const linkActive = "text-gray-900 dark:text-white bg-gray-900/5 dark:bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]";
// Было "hover:text-gray-900 dark:text-white": tailwind-merge оставлял последний dark:text-*,
// поэтому в тёмной теме неактивный пункт всегда был белым и не отличался от активного.
const linkIdle = "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-900/5 dark:hover:bg-white/5";

/** Пункт с подписью: им же меряется, помещаются ли подписи. */
const labeledClass = "px-3 py-2 text-sm font-medium";
const iconOnlyClass = "p-2.5";

function ItemContent({item, isActive, labeled}: {item: NavItem; isActive: boolean; labeled: boolean}) {
  return (
    <>
      <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-indigo-400" : "text-current")} />
      {labeled && <span>{item.name}</span>}
    </>
  );
}

export default function HeaderNav({isAdmin = false}: {isAdmin?: boolean}) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = isAdmin ? [...baseNavItems, adminItem] : baseNavItems;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Подписи показываются, когда помещаются целиком; иначе — только иконки с подсказкой.
  // Меряем невидимую копию с подписями: по самой навигации не понять, влезут ли подписи,
  // пока она показана без них. Стартуем с иконок, чтобы шапка не мигала переполнением.
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [labeled, setLabeled] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const update = () => setLabeled(measure.scrollWidth <= nav.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [navItems.length]);

  return (
    <>
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <nav
        ref={navRef}
        className="relative hidden md:flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden"
        aria-label="Основная навигация"
      >
        {/* Мерка: та же разметка с подписями, невидимая и вне потока. */}
        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1">
          {navItems.map(item => (
            <span key={item.href} className={cn(linkBase, labeledClass)}>
              <ItemContent item={item} isActive={false} labeled />
            </span>
          ))}
        </div>

        {navItems.map(item => {
          const isActive = isSectionActive(pathname, item.href);
          const link = (
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              // Без подписи имя ссылки для скринридеров даём явно.
              aria-label={labeled ? undefined : item.name}
              onClick={guardedClick(() => router.push(item.href))}
              className={cn(linkBase, labeled ? labeledClass : iconOnlyClass, isActive ? linkActive : linkIdle)}
            >
              <ItemContent item={item} isActive={isActive} labeled={labeled} />
            </Link>
          );
          // Подсказка нужна только иконке: у пункта с подписью она повторяла бы текст.
          if (labeled) return <span key={item.href} className="contents">{link}</span>;
          return (
            <Tooltip.Root key={item.href}>
              <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
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
                onClick={e => {
                  // Переход по ссылке закрывает меню.
                  setMobileOpen(false);
                  guardedClick(() => router.push(item.href))(e);
                }}
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
