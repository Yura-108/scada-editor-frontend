/** Площадки базы каналов (`/api/device/site/`); при ошибке — пустой список. */
export async function fetchChannelSites(): Promise<string[]> {
  const res = await fetch("/api/device/site/");
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? data.filter((s): s is string => typeof s === "string") : [];
}

/** Базы каналов площадки — ключи корневых узлов иерархии; полный путь уходит в `channel_root`. */
export async function fetchChannelRoots(site: string): Promise<string[]> {
  const res = await fetch(`/api/device/hierarchy?site=${encodeURIComponent(site)}`);
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  const data = await res.json() as {nodes?: {key: string}[]};
  return (data.nodes ?? []).map((n) => n.key);
}
