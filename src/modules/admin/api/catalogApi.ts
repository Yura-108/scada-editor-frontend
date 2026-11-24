/**
 * Чтение базы каналов для выбора веток каталога (#19 п. 2). Администратору каталог виден
 * целиком, поэтому дерево строится по тем же адресам, что и в «Базе каналов»: площадки,
 * прямые дети площадки (проекты базы каналов), всё поддерево проекта одним запросом.
 */

const readKeys = async (url: string, what: string): Promise<string[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить ${what} (${res.status})`);
  const body = (await res.json()) as {nodes?: {key: string}[]};
  return (body.nodes ?? []).map(n => n.key);
};

export const fetchCatalogSites = async (): Promise<string[]> => {
  const res = await fetch("/api/device/site/");
  if (!res.ok) throw new Error(`Не удалось загрузить площадки (${res.status})`);
  return (await res.json()) as string[];
};

/** Проекты базы каналов площадки — полные пути `площадка.проект`. */
export const fetchCatalogProjects = (site: string): Promise<string[]> =>
  readKeys(`/api/device/hierarchy?site=${encodeURIComponent(site)}`, `проекты площадки ${site}`);

/** Все узлы под проектом (без самого проекта) — полные пути. */
export const fetchCatalogSubtree = (project: string): Promise<string[]> =>
  readKeys(`/api/device/fullHierarchy?project=${encodeURIComponent(project)}`, `узлы проекта ${project}`);
