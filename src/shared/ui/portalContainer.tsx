"use client";

import React, {createContext, useContext} from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

/**
 * Куда выпадающие списки (`Select`, `PickerSelect`, `MultiSelect`) кладут свой портал. Без
 * провайдера — в `body`, как обычно. Провайдер нужен, когда кусок страницы живёт в своей теме
 * (`.light`/`.dark` на обёртке, колонки каталога /dev/ui): меню у `body` взяло бы тему страницы.
 */
export function PortalContainerProvider({container, children}: {container: HTMLElement | null; children: React.ReactNode}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

/** Контейнер портала или `undefined` — тогда Radix порталит в `body`. */
export const usePortalContainer = (): HTMLElement | undefined => useContext(PortalContainerContext) ?? undefined;
