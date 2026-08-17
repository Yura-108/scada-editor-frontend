import Canvas from "@/components/editor/Canvas";
import {useEditorStore} from "@/store/useEditorStore";

/**
 * Вкладка «Редактор» — обёртка холста.
 *
 * Отступ панели зума от правой боковой панели раньше приходил сюда числом
 * (`rightInset`) и менялся на каждый пиксель перетаскивания края. Теперь его
 * задаёт CSS-переменная `--ws-right-m` от WorkSpace, и проп не нужен.
 *
 * В режиме просмотра версии холст рисуется тем же кодом, но `readOnly` (как в
 * мониторе): слой уходит из hit-графа Konva, и старую версию нельзя случайно
 * подвинуть, приняв её за текущую сцену.
 */
export function EditorPanel() {
  const isVersionPreview = useEditorStore(s => s.versionPreview !== null);

  return (
    <div className="h-full w-full">
      <Canvas readOnly={isVersionPreview} />
    </div>
  );
}
