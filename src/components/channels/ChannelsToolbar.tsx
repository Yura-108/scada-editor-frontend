import {FileUp} from 'lucide-react';
import {Button} from "@/shared/ui/Button";
import {ChannelsProjectPicker} from "@/core/devices";
import {openImportCdbxModal} from "@/components/channels/OpenImportCdbxModal";

const compact = "px-3 py-1.5 text-sm shadow-none whitespace-nowrap";

/**
 * Верхняя панель «Базы каналов»: какие площадки и проекты загрузить в дерево, плюс импорт.
 *
 * Раньше это был отдельный полноэкранный блок с ярким градиентом под рабочей областью: до него
 * приходилось листать, и не все понимали, что он вообще есть. Теперь выбор всегда на виду,
 * в одной строке с названием раздела, как на остальных страницах.
 */
export default function ChannelsToolbar() {
  return (
    <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 whitespace-nowrap overflow-x-auto">
      <span className="hidden xl:inline text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">База каналов</span>

      <ChannelsProjectPicker />

      <div className="flex-1" />

      {/* Импорт создаёт НОВЫЙ проект: после отчёта он сам подгружается в дерево и появляется
          в списке проектов слева. */}
      <Button className={compact} onClick={openImportCdbxModal} title="Создать проект из файла базы каналов .cdbx">
        <FileUp size={14} />Импорт .cdbx
      </Button>
    </div>
  );
}
