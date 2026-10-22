import {QueryClient} from "@tanstack/react-query";

/**
 * Клиент TanStack Query для серверных данных (docs/architecture.md, «Состояние»).
 *
 * Умолчания выключают то, чего приложение до Query не делало, чтобы перевод очередного
 * стора не менял поведение исподтишка:
 * - `retry: false` — недоступный бэкенд сразу даёт ошибку и кнопку «Повторить», а не
 *   полминуты спиннера с тремя повторами;
 * - `refetchOnWindowFocus: false` — возврат на вкладку не перечитывает данные (форма
 *   с несохранёнными правками не должна получить новый список из-под рук).
 * Запрос, которому это нужно, включает их у себя явно.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {retry: false, refetchOnWindowFocus: false},
      mutations: {retry: false},
    },
  });
}
