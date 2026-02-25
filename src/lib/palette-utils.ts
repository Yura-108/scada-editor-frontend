export function filterPalette(items, search: string) {
  return items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
}

export function groupPalette(items) {
  return items.reduce((acc, item) => {
    const cat = item.category || "Другое";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
}

export function sortCategories(grouped: Record<string, any[]>) {
  return Object.keys(grouped).sort((a, b) => {
    if (a === "Основные") return -1;
    if (b === "Основные") return 1;
    return a.localeCompare(b);
  });
}