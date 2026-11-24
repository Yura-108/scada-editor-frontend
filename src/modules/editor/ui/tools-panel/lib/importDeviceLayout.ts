import {toast} from "sonner";
import {countOf} from "@/shared/lib/plural";
import {buildDeviceLayout, type DeviceLayoutFile} from "../../../lib/deviceLayoutImport";
import {openDeviceImportReportModal} from "../OpenDeviceImportReportModal";
import {getPaletteItems, loadPaletteItems} from "../../../model/palette";
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
  if (!getPaletteItems().some((i) => i.type === "custom")) {
    await loadPaletteItems();
  }

  const {scene, addImportedElements} = useEditorStore.getState();
  const {elements, report} = buildDeviceLayout(
    file,
    getPaletteItems(),
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
    `В файле ${countOf(report.devices, "устройство", "устройства", "устройств")}, `
    + `${countOf(report.lines, "линия", "линии", "линий")} и `
    + `${countOf(report.junctions, "узел", "узла", "узлов")} соединения. Что с ними сделать?`,
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
