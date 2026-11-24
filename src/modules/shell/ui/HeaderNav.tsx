"use client";

import {useLayoutEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter, usePathname} from "next/navigation";
import {cn} from "@/shared/lib/cn";
import {Menu, X} from "lucide-react";
import {Tooltip} from "radix-ui";
import {adminItem, baseNavItems, isSectionActive, type NavItem} from "../lib/navItems";
import {guardedClick} from "@/shared/lib/unsavedGuard";

const linkBase = cn(
  "flex shrink-0 items-center justify-center gap-2 rounded-xl transition-all duration-200 whitespace-nowrap",
  "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
);
const linkActive = "text-foreground bg-accent shadow-[inset_0_0_0_1px_var(--border)]";
// Было "hover:text-gray-900 dark:text-white": tailwind-merge оставлял последний dark:text-*,
// поэтому в тёмной теме неактивный пункт всегда был белым и не отличался от активного.
const linkIdle = "text-muted-foreground hover:text-foreground hover:bg-accent/60";

/** Пункт с подписью: им же меряется, помещаются ли подписи. */
const labeledClass = "px-3 py-2 text-sm font-medium";
const iconOnlyClass = "p-2.5";

function ItemContent({item, isActive, labeled}: {item: NavItem; isActive: boolean; labeled: boolean}) {
  return (
    <>
      <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-primary" : "text-current")} />
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
                  className="z-dropdown rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg select-none"
                >
                  {item.name}
                  <Tooltip.Arrow className="fill-foreground" />
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
        className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Основная навигация"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-dropdown min-w-52 rounded-xl border border-border bg-card p-1 shadow-2xl"
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
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-current")} />
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
