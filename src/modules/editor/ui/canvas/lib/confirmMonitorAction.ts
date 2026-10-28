import type {DiagramElement} from "@/types/editorElement.type";
import type {ElementEventName} from "@/types/binding.types";
import {confirmModal} from "@/components/ui/ConfirmModal";

/**
 * Подтверждение действия оператора в мониторе.
 *
 * Действие пишет значения в ПЛК, то есть двигает оборудование, и откатить его нельзя —
 * случайный клик по мнемосхеме равен команде. Спрашиваем ДО исполнения: у скрипта события
 * побочные эффекты начинаются с первой же строки, а `runScript(...)` внутри него уходит на
 * сервер, так что подтверждение «по ходу» было бы только видимостью защиты.
 *
 * Вызывается из трёх точек входа — слоя интеракции (клик по компоненту), меню монитора
 * (пункт серверного скрипта) и меню выбора `showMenu`, чтобы формулировка была одна.
 */

/** Вид события вместо имени: у обработчика клика своего названия нет. */
const EVENT_LABELS: Record<ElementEventName, string> = {
  onClick: "действие по клику",
  onDoubleClick: "действие по двойному клику",
};

/**
 * Открыт ли сейчас диалог подтверждения.
 *
 * Konva на двойном клике шлёт `click`, `click`, `dblclick`, поэтому у элемента с обоими
 * обработчиками оператор получил бы три диалога подряд. Признак модульный, а не на элемент:
 * двух действий сразу оператор всё равно не подтверждает, а очередь диалогов поверх
 * мнемосхемы хуже, чем пропущенный второй. Следствие: при двойном клике по такому элементу
 * выигрывает `onClick` — он приходит первым.
 */
let pending = false;

interface ConfirmMonitorActionOptions {
  element: DiagramElement;
  /** Имя серверного скрипта — когда действие запускают пунктом меню. */
  scriptName?: string;
  /** Вид события — когда действие висит на клике по компоненту. */
  event?: ElementEventName;
  /** Выбранный пункт меню `showMenu` — оператор видит, ЧТО именно сейчас уйдёт в ПЛК. */
  choice?: string;
}

export async function confirmMonitorAction(
  {element, scriptName, event, choice}: ConfirmMonitorActionOptions,
): Promise<boolean> {
  if (pending) return false;

  const label = element.label?.trim() || element.key;
  const title = scriptName
    ? choice ? `Выполнить «${scriptName}»: ${choice}?` : `Выполнить «${scriptName}»?`
    : `Выполнить ${event ? EVENT_LABELS[event] : "действие"}?`;

  pending = true;
  try {
    return await confirmModal({
      title,
      description: `Компонент «${label}». Действие может записать значения в ПЛК —`
        + " отменить запись нельзя.",
      confirmLabel: "Выполнить",
      danger: true,
    });
  } finally {
    pending = false;
  }
}
