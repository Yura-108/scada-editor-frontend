/**
 * Загруженные проекты и выбранный узел базы каналов в текущей вкладке (#16 п. 9).
 *
 * `sessionStorage`, а не `localStorage`: переживает F5, но новая вкладка и следующий день
 * начинаются с чистого листа. Запись помечена логином — после выхода и входа другого
 * пользователя в той же вкладке чужой выбор не подхватывается (права на проекты у него свои).
 * Хранилище может быть недоступно (приватный режим, запрет сайта) — тогда всё работает как
 * раньше, без памяти.
 */
const KEY = 'scada.channels.loadedProjects';

interface Memory {
  login: string;
  projects: string[];
  selectedDevice: string | null;
}

const readMemory = (login: string): Memory | null => {
  if (!login) return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const memory = JSON.parse(raw) as Partial<Memory>;
    if (memory.login !== login || !Array.isArray(memory.projects)) return null;
    const projects = memory.projects.filter((p): p is string => typeof p === 'string');
    if (!projects.length) return null;
    const selectedDevice = typeof memory.selectedDevice === 'string' ? memory.selectedDevice : null;
    return { login, projects, selectedDevice };
  } catch {
    return null;
  }
};

/** Проекты, загруженные в этой вкладке пользователем `login`. */
export const readLoadedProjects = (login: string): string[] | null =>
  readMemory(login)?.projects ?? null;

export const readSelectedDevice = (login: string): string | null =>
  readMemory(login)?.selectedDevice ?? null;

/** Запоминает загруженные проекты; пустой список или `null` стирает память. */
export const rememberLoadedProjects = (login: string, projects: string[] | null) => {
  try {
    if (!login || !projects?.length) window.sessionStorage.removeItem(KEY);
    else
      window.sessionStorage.setItem(
        KEY,
        JSON.stringify({
          login,
          projects,
          selectedDevice: readSelectedDevice(login),
        } satisfies Memory),
      );
  } catch {
    // Без хранилища просто не помним.
  }
};

export const rememberSelectedDevice = (login: string, selectedDevice: string | null) => {
  const memory = readMemory(login);
  if (!memory || memory.selectedDevice === selectedDevice) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...memory, selectedDevice }));
  } catch {
    // Без хранилища выбор действует до перезагрузки.
  }
};
