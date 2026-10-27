import React, {useRef} from "react";
import {toast} from "sonner";
import {isDeviceLayoutFile} from "../../../lib/deviceLayoutImport";
import {useEditorStore} from "../../../model/editorStore";
import {SCENE_EXPORT_FORMAT} from "../../../model/editorStoreInternals";
import {askImportMode} from "../lib/askImportMode";
import {describeImportStats} from "../lib/describeImportStats";
import {importDeviceLayout} from "../lib/importDeviceLayout";

/**
 * Импорт схемы из файла: кнопка открывает скрытый `<input type="file">`, файл разбирается
 * в одну из трёх веток — план устройств, наш экспорт или выгрузка CONTUR.
 */
export function useSceneFileImport(sceneBelongsToProject: boolean) {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    if (!useEditorStore.getState().scene) {
      toast.info("Сначала загрузите или создайте схему");
      return;
    }
    if (!sceneBelongsToProject) {
      toast.error("Схема не принадлежит выбранному проекту");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sceneBelongsToProject) {
      toast.error("Схема не принадлежит выбранному проекту");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);

        // План устройств — объект {devices, lines}, а не массив. Ветка должна стоять
        // ДО общего распознавания: там объект без нашего конверта заворачивается в
        // [json] и становится одним мусорным элементом.
        if (isDeviceLayoutFile(json)) {
          await importDeviceLayout(json);
          return;
        }

        // Свой файл приезжает конвертом (см. buildSceneExport), чужая выгрузка — голым
        // массивом. Флаг `native` важнее удобства: без него нормализатор CONTUR второй
        // раз пересчитал бы координаты схемы, однажды пришедшей из выгрузки.
        const native = !Array.isArray(json)
          && json?.format === SCENE_EXPORT_FORMAT
          && Array.isArray(json.elements);
        const arr: Record<string, unknown>[] = native
          ? json.elements
          : (Array.isArray(json) ? json : [json]);

        const mode = await askImportMode(`В файле ${arr.length} элементов. Что с ними сделать?`);
        if (!mode) return;

        const stats = useEditorStore.getState().importElementsFromJson(arr, {mode, native});

        if (!stats) {
          toast.success(`Импортировано элементов: ${arr.length}`);
          return;
        }

        toast.success(`Импортировано элементов: ${stats.total}`, {
          description: describeImportStats(stats),
          duration: 12_000,
        });

        if (stats.repairedLinks) {
          toast.warning(`Достроено связей групп: ${stats.repairedLinks}`, {
            description: "В файле были односторонние ссылки родитель ↔ ребёнок. Стоит сказать об этом CONTUR.",
            duration: 12_000,
          });
        }
      } catch {
        toast.error("Ошибка чтения файла: неверный JSON");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return {importInputRef, handleImport, handleImportFile};
}
