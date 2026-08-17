import './globals.css';
import { Geist } from 'next/font/google';
import Providers from './providers';
import { ThemeProvider } from 'next-themes';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import React from 'react';
import { ModalRoot } from '@/components/ui/ModalRoot';
import { ConfirmRoot } from '@/components/ui/ConfirmModal';
import { cn } from '@/lib/utils';

// Имя переменной должно совпадать с --font-geist-sans из globals.css (@theme inline).
const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

/**
 * Корневой layout: только оболочка документа, провайдеры и глобальные стеки окон.
 *
 * Шапка с навигацией переехала в layout группы (app) — здесь она рендерилась
 * безусловно и висела в том числе над /login и /register.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <WebSocketProvider>
              {children}
              <ModalRoot />
              {/* Отдельный стек — подтверждение может открыться поверх обычной модалки. */}
              <ConfirmRoot />
            </WebSocketProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
