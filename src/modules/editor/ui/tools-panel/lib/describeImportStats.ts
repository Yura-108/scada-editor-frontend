import type {ConturImportStats} from "@/lib/editor/conturImport";

/**
 * Разбивка импорта по типам — она же приёмка: контрольные числа листа сверяются глазами,
 * без консоли (см. docs/contur/CONTUR_IMPORT_PLAN.md, §5). Виды перечислены все, что бывают
 * в выгрузке: пропущенный вид — это молча не сошедшееся число при приёмке.
 */
export function describeImportStats(stats: ConturImportStats): string {
  const breakdown = [
    `техобъектов ${stats.groups}`,
    stats.frameLines
      ? `линий чертежа ${stats.lines} (рамка листа ${stats.frameLines})`
      : `линий чертежа ${stats.lines}`,
    `устройств ${stats.circles}`,
    `подписей ${stats.labels}`,
    `имён контуров ${stats.contourNames}`,
    `рамок ${stats.contourFrames + stats.frames}`,
  ];
  if (stats.drawingTexts) breakdown.push(`надписей чертежа ${stats.drawingTexts}`);
  if (stats.meta) breakdown.push(`данные листа ${stats.meta}`);
  return breakdown.join(" · ");
}
