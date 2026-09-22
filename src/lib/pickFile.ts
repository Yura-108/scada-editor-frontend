/**
 * Открывает системный проводник и возвращает выбранный файл (или `null`, если отменили).
 *
 * Отличается от `pickImageFile` тем, что отдаёт сам `File`, а не data URL: файл уходит
 * дальше в `FormData` как есть, и читать его в память на клиенте незачем — у `.cdbx` это
 * мегабайты.
 *
 * Создаёт временный `<input type="file">` и синхронно кликает по нему, поэтому вызов
 * ОБЯЗАН происходить внутри пользовательского жеста, иначе браузер не откроет диалог.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener("change", () => finish(input.files?.[0] ?? null));

    // Диалог закрыт без выбора файла (современные браузеры). На старых событие не придёт —
    // промис останется висеть, но это безвредно: элемент уже убран из потока.
    input.addEventListener("cancel", () => finish(null));

    input.click();
  });
}
