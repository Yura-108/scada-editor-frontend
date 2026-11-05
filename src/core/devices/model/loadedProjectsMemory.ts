/**
 * Какие проекты базы каналов загружены в этой вкладке — чтобы после F5 дерево вернулось само,
 * а не встречало «Площадка… / Сначала площадка» (#16 п. 9).
 *
 * `sessionStorage`, а не `localStorage`: переживает F5, но новая вкладка и следующий день
 * начинаются с чистого листа. Запись помечена логином — после выхода и входа другого
 * пользователя в той же вкладке чужой выбор не подхватывается (права на проекты у него свои).
 * Хранилище может быть недоступно (приватный режим, запрет сайта) — тогда всё работает как
 * раньше, без памяти.
 */
const KEY = "scada.channels.loadedProjects";

interface Memory {
  login: string;
  projects: string[];
}

/** Проекты, загруженные в этой вкладке пользователем `login`; `null` — нечего восстанавливать. */
export const readLoadedProjects = (login: string): string[] | null => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const memory = JSON.parse(raw) as Partial<Memory>;
    if (memory.login !== login || !Array.isArray(memory.projects)) return null;
    const projects = memory.projects.filter((p): p is string => typeof p === "string");
    return projects.length ? projects : null;
  } catch {
    return null;
  }
};

/** Запоминает загруженные проекты; пустой список или `null` стирает память. */
export const rememberLoadedProjects = (login: string, projects: string[] | null) => {
  try {
    if (!login || !projects?.length) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify({login, projects} satisfies Memory));
  } catch {
    // Без хранилища просто не помним.
  }
};
