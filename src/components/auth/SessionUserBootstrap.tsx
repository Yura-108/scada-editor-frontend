"use client";

import {useLayoutEffect} from "react";
import {useSessionUserStore} from "@/store/useSessionUserStore";

/**
 * Переносит логин и флаг админа из серверного layout в клиентский стор.
 *
 * `useLayoutEffect`, а не `useEffect`: layout-эффекты всего дерева выполняются раньше
 * обычных, так что первые загрузки страниц уже видят флаг админа.
 */
export default function SessionUserBootstrap({login, admin}: {login: string; admin: boolean}) {
  useLayoutEffect(() => {
    useSessionUserStore.getState().setUser({login, admin});
  }, [login, admin]);
  return null;
}
