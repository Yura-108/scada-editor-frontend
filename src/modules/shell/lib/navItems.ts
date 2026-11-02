import {Activity, ClipboardList, Cpu, Database, HashIcon, Layout, Scroll, ShieldCheck, type LucideIcon} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Раздел работает с выбранным проектом — его имя попадает в заголовок вкладки браузера. */
  projectScoped?: boolean;
}

export const baseNavItems: NavItem[] = [
  {name: "Редактор схем", href: "/editor", icon: Layout, projectScoped: true},
  {name: "Монитор", href: "/monitor", icon: Activity, projectScoped: true},
  {name: "Автоматизация", href: "/automation", icon: Cpu, projectScoped: true},
  {name: "Данные проекта", href: "/data", icon: Database, projectScoped: true},
  {name: "База каналов", href: "/channels", icon: HashIcon},
  {name: "Логирование", href: "/log", icon: Scroll},
  {name: "Журнал действий", href: "/actions", icon: ClipboardList},
];

/** Только администратору (claim `admin` из токена); сама страница проверяет это ещё раз. */
export const adminItem: NavItem = {name: "Администрирование", href: "/admin", icon: ShieldCheck};

/**
 * Раздел считается активным и на вложенных маршрутах: точное сравнение
 * `pathname === href` не подсвечивало ни `/channels/123`, ни любой другой
 * вложенный путь.
 */
export const isSectionActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const sectionOf = (pathname: string): NavItem | undefined =>
  [...baseNavItems, adminItem].find(item => isSectionActive(pathname, item.href));
