import {create} from "zustand";

/**
 * Кто вошёл: логин и флаг администратора из JWT (claim `admin`).
 *
 * Значения кладёт `SessionUserBootstrap` из серверного layout: cookie с токеном httpOnly,
 * клиенту его не прочитать. Права по проектам отсюда НЕ берутся — они меняются без
 * перевыпуска токена и приходят в списке проектов (`EditorProject.access`). Флаг админа
 * в токене тоже может устареть; это только удобство, отказывает всё равно бэкенд.
 */
interface SessionUserState {
  login: string;
  admin: boolean;
  setUser: (user: {login: string; admin: boolean}) => void;
}

export const useSessionUserStore = create<SessionUserState>(set => ({
  login: "",
  admin: false,
  setUser: user => set(user),
}));
