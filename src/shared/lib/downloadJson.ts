/**
 * Отдаёт данные пользователю файлом — через Blob и временную ссылку.
 *
 * Своим модулем, потому что это единственное место во всём редакторе, где мы трогаем
 * DOM ради побочного эффекта: стор такими вещами не занимается, а компоненту незачем
 * знать про `URL.createObjectURL` и его отзыв.
 */
export const downloadJson = (fileName: string, data: unknown): void => {
  // Отступ в два пробела: файл будут открывать глазами и класть в git, а не только
  // скармливать обратно импорту.
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Без отзыва Blob висит в памяти до перезагрузки вкладки, а схема — это мегабайты.
  URL.revokeObjectURL(url);
};

/**
 * Имя файла из названия схемы: запрещённые в файловых системах символы — в подчёркивание.
 * Пустое имя заменяем, иначе браузер сохранит файл как «download».
 */
export const safeFileName = (name: string | undefined | null, fallback: string): string => {
  const cleaned = (name ?? "").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
};
