'use client';

import { CSSProperties, ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { installAuthInterceptor } from "@/core/access";
import { getQueryClient } from '@/shared/api/queryClient';

// На уровне модуля — до первых запросов страниц (см. installAuthInterceptor).
installAuthInterceptor();

/**
 * Клиентские провайдеры приложения.
 *
 * QueryClientProvider — для серверных данных, переводимых с рукописных
 * useEffect + zustand на TanStack Query (docs/architecture.md, шаг 5 плана).
 * Клиент — `getQueryClient()`: у каждого запроса SSR свой кэш, а в браузере он один на всё
 * время жизни вкладки, и тот же клиент доступен коду вне React.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // Без theme sonner по умолчанию светлый — на тёмной странице тосты были белыми.
  const { resolvedTheme } = useTheme();
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        richColors
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        // Слой берём из общей шкалы (globals.css), а не из умолчания sonner.
        style={{ zIndex: 'var(--z-toast)' } as CSSProperties}
      />
    </QueryClientProvider>
  );
}
