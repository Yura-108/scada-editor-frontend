import { FileUp } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { PageHeader } from '@/shared/ui/page/PageHeader';
import type { SectionHelp } from '@/shared/ui/page/PageHelp';
import { ChannelsProjectPicker } from '@/core/devices';
import { openImportCdbxModal } from './OpenImportCdbxModal';

const CHANNELS_HELP = {
  title: 'База каналов',
  body: (
    <p>
      Здесь настраивают устройства и каналы. Выберите площадку и проекты, нажмите «Загрузить» и
      откройте устройство в дереве.
    </p>
  ),
  more: (
    <ul>
      <li>Чтобы создать проект из существующей базы, нажмите «Импорт .cdbx».</li>
      <li>Теги каналов используют в схемах, рецептах и задачах автоматизации.</li>
      <li>Изменения устройств и параметров можно посмотреть в разделе «Логирование».</li>
    </ul>
  ),
} satisfies SectionHelp;

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
      help={CHANNELS_HELP}
      helpSectionId="channels"
      actions={
        // Импорт создаёт НОВЫЙ проект: после отчёта он сам подгружается в дерево и появляется
        // в списке проектов слева.
        // На узком окне — только иконка: подпись в подсказке и для скринридера.
        <Button
          size="sm"
          onClick={openImportCdbxModal}
          title="Импорт .cdbx: создать проект из файла базы каналов"
          aria-label="Импорт .cdbx"
        >
          <FileUp size={14} />
          <span className="hidden lg:inline">Импорт .cdbx</span>
        </Button>
      }
    >
      <ChannelsProjectPicker />
    </PageHeader>
  );
}
