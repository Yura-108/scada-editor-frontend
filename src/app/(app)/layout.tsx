import React from 'react';
import Link from 'next/link';
import { Cpu, Settings } from 'lucide-react';
import LogoutButton from '@/components/ui/LogoutButton';
import { getUser } from '@/lib/getUser';
import HeaderNav from '@/components/editor/HeaderNav';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Оболочка рабочей области: шапка с навигацией + содержимое страницы.
 *
 * Шапка живёт именно здесь, а не в корневом layout: там она рендерилась
 * безусловно, и неавторизованный пользователь на /login видел полное меню,
 * каждая ссылка которого возвращала его обратно на /login. Страницы входа и
 * регистрации лежат в группе (auth) и этот layout не наследуют.
 *
 * Высота шапки задана переменной --app-header-h (globals.css): её же используют
 * утилиты min-h-app / h-app и `top-(--app-header-h)` в редакторе и мониторе.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <>
      <header className="sticky top-0 z-header w-full border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-gray-900/70 backdrop-blur-md">
        <div className="container mx-auto px-4 h-(--app-header-h) flex items-center justify-between">
          {/* Логотип — ссылка на главную (обычное ожидание от шапки) и заодно
              единственное место, где написано название продукта: раньше это был
              немой div, а подпись рядом была закомментирована. */}
          <Link
            href="/channels"
            className="flex items-center gap-3 rounded-lg"
            aria-label="СКАДА — на главную"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:inline font-bold text-lg tracking-tight text-gray-900 dark:text-white">
              СКАДА
            </span>
          </Link>

          <HeaderNav />

          {/* Правая часть: Кнопки действий */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Настройки"
              title="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>
            {user && (
              <>
                <div className="h-8 w-px bg-gray-100 dark:bg-gray-800" />
                <LogoutButton />
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
