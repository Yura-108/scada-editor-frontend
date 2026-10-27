import {toast} from "sonner";
import {buildDeviceLayout, type DeviceLayoutFile} from "../../../lib/deviceLayoutImport";
import {openDeviceImportReportModal} from "../OpenDeviceImportReportModal";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useEditorStore} from "../../../model/editorStore";
import {askImportMode} from "./askImportMode";

/**
 * План устройств: «какой шаблон взять и в какие координаты поставить».
 *
 * Экземпляры собираются одним массивом и кладутся одним действием — иначе 47 вызовов
 * `addTemplate` дали бы 47 шагов undo при лимите истории в 50.
 */
export async function importDeviceLayout(file: DeviceLayoutFile): Promise<void> {
  // Палитра грузится при монтировании редактора, но если запрос не прошёл, в списке
  // останутся только статические элементы — без шаблонов импортировать нечего.
  if (!usePaletteStore.getState().paletteItems.some((i) => i.type === "custom")) {
    await usePaletteStore.getState().loadPaletteItems();
  }

  const {scene, addImportedElements} = useEditorStore.getState();
  const {elements, report} = buildDeviceLayout(
    file,
    usePaletteStore.getState().paletteItems,
    scene?.id ?? null,
  );

  // Выходим ДО вопроса о режиме: с «Заменить» пустой результат стёр бы всю схему.
  if (!elements.length) {
    toast.error("Импорт не дал ни одного элемента", {
      description: "Ни одного из шаблонов файла нет в палитре.",
    });
    openDeviceImportReportModal(report);
    return;
  }

  const mode = await askImportMode(
    `В файле ${report.devices} устройств, ${report.lines} линий и ${report.junctions} узлов соединения. Что с ними сделать?`,
  );
  if (!mode) return;

  addImportedElements(elements, mode);

  toast.success(`Поставлено устройств: ${report.placed} из ${report.devices}`, {
    description: [
      `линий ${report.lines}`,
      `узлов ${report.junctions}`,
      `повёрнуто ${report.rotated}`,
      `отражено ${report.mirrored}`,
      `элементов на холсте ${elements.length}`,
    ].join(" · "),
    duration: 12_000,
  });

  if (report.missing.length || report.ambiguous.length || report.unsupportedRotation.length) {
    openDeviceImportReportModal(report);
  }
}
