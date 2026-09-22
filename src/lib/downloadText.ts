/**
 * Отдаёт текст пользователю файлом — тем же приёмом, что `downloadJson`, но без сериализации:
 * блок для `controllers.yaml` приходит с бэкенда готовой строкой, и пересобирать её нельзя,
 * иначе поедут отступы, от которых в YAML зависит смысл.
 */
export const downloadText = (
  fileName: string,
  text: string,
  type = "text/plain;charset=utf-8",
): void => {
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Без отзыва блоб висит в памяти до перезагрузки вкладки.
  URL.revokeObjectURL(url);
};

/**
 * Копирование в системный буфер. `navigator.clipboard` доступен только в защищённом
 * контексте (https или localhost) и может быть запрещён политикой, поэтому результат
 * возвращаем булевым — вызывающий сам решит, показать успех или предложить выделить текст.
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Не удалось скопировать в буфер обмена:", err);
    return false;
  }
};
