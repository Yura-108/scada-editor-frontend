'use client';

import { CSSProperties, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

/**
 * Клиентские провайдеры приложения.
 *
 * QueryClientProvider отсюда убран: @tanstack/react-query был настроен на всё
 * приложение, но единственным его потребителем оставался мёртвый TreeLoaderForm
 * (удалён вместе с прочим мёртвым кодом). Всё реальное получение данных идёт
 * через рукописные useEffect + zustand. Если react-query понадобится снова —
 * провайдер возвращается сюда, а пока сама зависимость в package.json не нужна.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // Без theme sonner по умолчанию светлый — на тёмной странице тосты были белыми.
  const { resolvedTheme } = useTheme();

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        // Слой берём из общей шкалы (globals.css), а не из умолчания sonner.
        style={{ zIndex: 'var(--z-toast)' } as CSSProperties}
      />
    </>
  );
}
