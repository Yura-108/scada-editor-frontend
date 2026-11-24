'use client';

import { useEffect } from 'react';
import { Building2, FolderOpen } from 'lucide-react';
import {ChannelsToolbar, DeviceParams} from "@/modules/channels";
import {DeviceTreePanel, useDeviceTreeStore} from "@/core/devices";
import {EmptyState} from "@/shared/ui/EmptyState";
import {PageFrame} from "@/shared/ui/page/PageFrame";

/** Пусто, пока ничего не загружено: подсказываем, где выбрать, вместо пустых панелей. */
function NothingLoaded() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Проект не загружен"
      description={<>
        На панели сверху выберите <Building2 className="inline h-4 w-4 align-text-bottom" /> площадку,
        затем один или несколько проектов и нажмите «Загрузить» — слева появится дерево устройств.
        <span className="mt-2 block text-xs">
          Нет нужного проекта — импортируйте базу из файла кнопкой «Импорт .cdbx» справа сверху.
        </span>
      </>}
    />
  );
}

export default function Workspace() {
  const nodes = useDeviceTreeStore(s => s.nodes);
  const isLoadingNodes = useDeviceTreeStore(s => s.isLoadingNodes);
  const nodesError = useDeviceTreeStore(s => s.nodesError);
  const loadedRootPath = useDeviceTreeStore(s => s.loadedRootPath);
  const loaded = nodes.length > 0 || isLoadingNodes || nodesError != null || (loadedRootPath?.length ?? 0) > 0;

  // При входе в базу каналов подхватываем изменения (например, отмену действия в логах),
  // если данные были помечены устаревшими.
  useEffect(() => {
    void useDeviceTreeStore.getState().refreshIfStale();
  }, []);

  return (
    <PageFrame>
      <ChannelsToolbar />

      {loaded ? (
        <main className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4 overflow-y-auto md:overflow-hidden">
          <aside className="shrink-0 h-[60vh] md:h-full md:w-80 lg:w-96">
            <DeviceTreePanel fill />
          </aside>
          <section className="flex-1 min-w-0 md:overflow-y-auto">
            <DeviceParams />
          </section>
        </main>
      ) : (
        <NothingLoaded />
      )}
    </PageFrame>
  );
}
