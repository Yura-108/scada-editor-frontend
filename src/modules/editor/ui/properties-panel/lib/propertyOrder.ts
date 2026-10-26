import {PropertyCreateDto} from "@/types/tags.types";

/**
 * Ключ свойства в списке.
 *
 * Серверного id может не быть: свойства из шаблона палитры приезжают черновиками (тег
 * у каждого экземпляра свой, а без тега свойство на сервере не заводится). Для таких
 * ключом служит имя — в пределах одного элемента оно и так обязано быть уникальным,
 * по нему идёт разрешение ссылок и сбор скоупа биндингов.
 */
export const propertyKey = (p: PropertyCreateDto): string =>
  p.id != null ? `id-${p.id}` : `draft-${p.name}`;

/** Теговое свойство без тега — черновик из шаблона, его надо донастроить. */
export const needsTag = (p: PropertyCreateDto): boolean =>
  p.property_type === "Тег" && !p.tag_id;

/**
 * Свойства в порядке показа: по `position`, затем по id. `localOrder` — порядок, который
 * перетаскивание уже показало, а стор ещё не пересчитал; новые свойства — в хвост.
 */
export function sortProperties(
  properties: PropertyCreateDto[],
  localOrder: string[] | null,
): PropertyCreateDto[] {
  const base = [...properties].sort((a, b) =>
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
    || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
  );
  if (!localOrder) return base;
  const byId = new Map(base.map(p => [propertyKey(p), p] as const));
  const reordered = localOrder.map(id => byId.get(id)).filter((p): p is PropertyCreateDto => Boolean(p));
  for (const p of base) if (!localOrder.includes(propertyKey(p))) reordered.push(p);
  return reordered;
}
