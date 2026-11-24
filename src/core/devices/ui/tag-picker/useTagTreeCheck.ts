import type {Key} from "rc-tree/es/interface";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";

/**
 * Сколько каналов одна галочка отмечает без вопроса. Галочка площадки или проекта — это сотни
 * и тысячи тегов (BN1 — 2740), рецепту столько не нужно: случайный клик не должен молча
 * набить список (#24 п. 1).
 */
const BULK_CHECK_LIMIT = 50;

function pluralTags(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "тег";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "тега";
  return "тегов";
}

interface Params {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Ключи каналов (листьев) всего дерева. */
  leafKeys: Set<string>;
  /** Ключи узлов, которые сейчас в дереве (с учётом поиска). */
  visibleKeys: Set<string>;
  expandedKeys: Key[];
  setExpandedKeys: (keys: Key[]) => void;
}

/**
 * Отметки дерева нескольких тегов.
 *
 * Отмечают только галочки. Клик по названию ветки раскрывает или сворачивает её, клик по
 * названию канала ставит или снимает его галочку — так строка больше не отмечает всё
 * поддерево незаметно (#24 п. 1).
 */
export function useTagTreeCheck({value, onChange, leafKeys, visibleKeys, expandedKeys, setExpandedKeys}: Params) {
  // `rc-tree` пересчитывает отметки по ВИДИМОМУ дереву, поэтому отметки, сделанные до
  // фильтра, сохраняем руками: иначе «нашёл — отметил — очистил поиск — отметил ещё» тихо
  // теряло бы первую половину выбора. Отмечены только каналы; галочки папок (в том числе
  // частичные) `rc-tree` выводит из них сам — `checkStrictly` выключен.
  const check = async (keys: Key[]) => {
    const hidden = value.filter((k) => !visibleKeys.has(k));
    const next = [...hidden, ...(keys as string[]).filter((key) => leafKeys.has(key))];
    const before = new Set(value);
    const added = next.filter((k) => !before.has(k)).length;
    if (added > BULK_CHECK_LIMIT) {
      const ok = await confirmModal({
        title: `Отметить ${added} ${pluralTags(added)}?`,
        description: "Галочка ветки отмечает все каналы под ней. Рецепту обычно нужны несколько тегов — проверьте, что ветка та.",
        confirmLabel: "Отметить",
      });
      if (!ok) return;
    }
    onChange(next);
  };

  const clickRow = (key: string) => {
    if (leafKeys.has(key)) {
      onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
      return;
    }
    setExpandedKeys(expandedKeys.includes(key) ? expandedKeys.filter((k) => k !== key) : [...expandedKeys, key]);
  };

  return {check, clickRow};
}
