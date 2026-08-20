import {PaletteItemType} from "@/types/palette.types";

export function filterPalette(items: PaletteItemType[], search: string) {
  return items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );
}

export function groupPalette(items: PaletteItemType[]) {
  return items.reduce((acc, item) => {
    const cat = item.category || "Другое";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
}

export function sortCategories(grouped: Record<string, any[]>) {
  return Object.keys(grouped).sort((a, b) => {
    if (a === "Основные" || a === "Basic") return -1;
    if (b === "Основные" || b === "Basic") return 1;
    return a.localeCompare(b);
  });
}