import React from 'react';
import { Cpu } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';

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
    <div className="min-h-screen flex flex-col bg-muted">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Cpu className="w-5 h-5 text-primary-foreground" />
        </div>
        <ThemeToggle />
      </div>

      {/* От верха, а не по центру: при центрировании любая строка ошибки («Введите логин»,
          «Неверный логин или пароль») сдвигала всю карточку вверх (#5 п. 2). */}
      <main className="flex-1 flex items-start justify-center p-4 sm:pt-[10vh]">{children}</main>
    </div>
  );
}
