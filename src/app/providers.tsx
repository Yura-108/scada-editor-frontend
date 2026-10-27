'use client';

import { CSSProperties, ReactNode, useState } from 'react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { installAuthInterceptor } from "@/core/access";
import { createQueryClient } from '@/shared/api/queryClient';

// На уровне модуля — до первых запросов страниц (см. installAuthInterceptor).
installAuthInterceptor();

/**
 * Клиентские провайдеры приложения.
 *
 * QueryClientProvider — для серверных данных, переводимых с рукописных
 * useEffect + zustand на TanStack Query (docs/architecture.md, шаг 5 плана).
 * Клиент создаётся в useState, а не на уровне модуля: так у каждого запроса SSR
 * свой кэш, а в браузере он один на всё время жизни вкладки.
 */
export default function Providers({ children }: { children: ReactNode }) {
  // Без theme sonner по умолчанию светлый — на тёмной странице тосты были белыми.
  const { resolvedTheme } = useTheme();
  const [queryClient] = useState(createQueryClient);

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
