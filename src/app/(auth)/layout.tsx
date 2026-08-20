import React from 'react';
import { Cpu } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Оболочка страниц входа и регистрации.
 *
 * Шапка приложения сюда намеренно не попадает (она в группе (app)):
 * неавторизованному пользователю показывать навигацию бессмысленно — каждая
 * ссылка вернула бы его обратно на /login. Остаются только логотип и
 * переключатель темы, иначе тему на этих страницах было бы не поменять.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <ThemeToggle />
      </div>

      <main className="flex-1 flex items-center justify-center p-4">{children}</main>
    </div>
  );
}
