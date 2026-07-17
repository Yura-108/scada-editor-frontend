import {snap} from "@/lib/utils";

/**
 * Открывает системный проводник для выбора картинки и возвращает её как data URL
 * (или null, если пользователь отменил выбор).
 *
 * Создаёт временный `<input type="file">` и синхронно кликает по нему — вызов
 * ОБЯЗАН происходить внутри пользовательского жеста (drop/click), иначе браузер
 * заблокирует открытие диалога.
 */
export function pickImageFile(accept = "image/*"): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    });

    // Диалог закрыт без выбора файла (современные браузеры). На старых событие не
    // придёт — промис останется висеть, но это безвредно (элемент уже создан).
    input.addEventListener("cancel", () => finish(null));

    input.click();
  });
}

/**
 * Натуральный размер картинки, вписанный в квадрат `max` с сохранением пропорций
 * и привязкой к сетке. Для несчитываемой картинки — max×max.
 */
export function fitImageSize(src: string, max = 240): Promise<{w: number; h: number}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || max;
      const ih = img.naturalHeight || max;
      const scale = Math.min(1, max / Math.max(iw, ih));
      const dim = (v: number) => Math.max(20, snap(v * scale));
      resolve({w: dim(iw), h: dim(ih)});
    };
    img.onerror = () => resolve({w: max, h: max});
    img.src = src;
  });
}
