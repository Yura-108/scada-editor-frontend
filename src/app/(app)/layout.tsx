import React from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import UserMenu from '@/components/auth/UserMenu';
import SessionUserBootstrap from '@/components/auth/SessionUserBootstrap';
import { getUser } from '@/lib/getUser';
import HeaderNav from '@/components/editor/HeaderNav';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Оболочка рабочей области: шапка с навигацией + содержимое страницы.
 *
 * Шапка живёт именно здесь, а не в корневом layout: там она рендерилась
 * безусловно, и неавторизованный пользователь на /login видел полное меню,
 * каждая ссылка которого возвращала его обратно на /login. Страница входа
 * лежит в группе (auth) и этот layout не наследует.
 *
 * Высота шапки задана переменной --app-header-h (globals.css): её же используют
 * утилиты min-h-app / h-app и `top-(--app-header-h)` в редакторе и мониторе.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <>
      {user && <SessionUserBootstrap login={user.login} admin={user.admin} />}
      <header className="sticky top-0 z-header w-full border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-gray-900/70 backdrop-blur-md">
        {/* Во всю ширину, а не `container`: разделов стало 7, и в фиксированную ширину
            контейнера они не помещались. Навигация занимает место между логотипом и
            кнопками и сама ужимается по ширине (см. HeaderNav). */}
        <div className="w-full px-4 2xl:px-6 h-(--app-header-h) flex items-center justify-between gap-3">
          {/* Логотип — ссылка на главную (обычное ожидание от шапки) и заодно
              единственное место, где написано название продукта: раньше это был
              немой div, а подпись рядом была закомментирована. */}
          <Link
            href="/channels"
            className="flex shrink-0 items-center gap-3 rounded-lg"
            aria-label="СКАДА — на главную"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline md:hidden lg:inline font-bold text-lg tracking-tight text-gray-900 dark:text-white">
              СКАДА
            </span>
          </Link>

          <HeaderNav isAdmin={user?.admin ?? false} />

          {/* Правая часть: Кнопки действий */}
          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <ThemeToggle />
            {user && (
              <>
                <div className="h-8 w-px bg-gray-100 dark:bg-gray-800" />
                <UserMenu login={user.login} />
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
