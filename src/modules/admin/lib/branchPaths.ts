/**
 * Пути веток каталога: ветка — узел базы каналов вместе со всем, что под ним. Чистые функции
 * для дерева выбора веток (#19 п. 2).
 */

const parentOf = (key: string): string => {
  const dot = key.lastIndexOf(".");
  return dot < 0 ? "" : key.slice(0, dot);
};

/** Лежит ли `key` строго под веткой `branch`. */
export const isUnder = (key: string, branch: string): boolean => key.startsWith(`${branch}.`);

/** Ветка, покрывающая `key` (сама или выше), если такая есть. */
export const coveringBranch = (key: string, branches: readonly string[]): string | undefined =>
  branches.find(b => b === key || isUnder(key, b));

/**
 * Отметить ветку: ветки под ней теперь лишние — их покрывает новая. Порядок — по алфавиту,
 * чтобы список не прыгал от порядка кликов.
 */
export const addBranch = (branches: readonly string[], key: string): string[] =>
  [...branches.filter(b => !isUnder(b, key) && b !== key), key].sort((a, b) => a.localeCompare(b, "ru"));

export const removeBranch = (branches: readonly string[], key: string): string[] =>
  branches.filter(b => b !== key);

/** Все предки пути, от площадки вниз, без самого пути. */
export const ancestorsOf = (key: string): string[] => {
  const out: string[] = [];
  for (let p = parentOf(key); p; p = parentOf(p)) out.unshift(p);
  return out;
};

export interface CatalogNode {
  key: string;
  title: string;
  parentKey: string;
}

export const toCatalogNode = (key: string): CatalogNode => ({
  key,
  title: key.slice(key.lastIndexOf(".") + 1),
  parentKey: parentOf(key),
});

/** Дети по родителю, в порядке появления (площадки и проекты сортирует загрузчик). */
export const childrenIndex = (nodes: Iterable<CatalogNode>): Map<string, CatalogNode[]> => {
  const index = new Map<string, CatalogNode[]>();
  for (const node of nodes) {
    const list = index.get(node.parentKey);
    if (list) list.push(node);
    else index.set(node.parentKey, [node]);
  }
  return index;
};

/** Равны ли наборы веток без учёта порядка — есть ли что сохранять. */
export const sameBranches = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every(x => set.has(x));
};
