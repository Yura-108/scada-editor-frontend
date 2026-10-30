import {FileUp} from 'lucide-react';
import {Button} from "@/shared/ui/Button";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {ChannelsProjectPicker} from "@/core/devices";
import {openImportCdbxModal} from "./OpenImportCdbxModal";

/**
 * Верхняя панель «Базы каналов»: какие площадки и проекты загрузить в дерево, плюс импорт.
 *
 * Раньше это был отдельный полноэкранный блок с ярким градиентом под рабочей областью: до него
 * приходилось листать, и не все понимали, что он вообще есть. Теперь выбор всегда на виду,
 * в одной строке с названием раздела, как на остальных страницах.
 */
export default function ChannelsToolbar() {
  return (
    <PageHeader
      title="База каналов"
      actions={
        // Импорт создаёт НОВЫЙ проект: после отчёта он сам подгружается в дерево и появляется
        // в списке проектов слева.
        <Button size="sm" onClick={openImportCdbxModal} title="Создать проект из файла базы каналов .cdbx">
          <FileUp size={14} />Импорт .cdbx
        </Button>
      }
    >
      <ChannelsProjectPicker />
    </PageHeader>
  );
}
