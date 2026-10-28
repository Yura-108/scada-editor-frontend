'use client';

import { useEffect } from 'react';
import { Building2, FolderOpen } from 'lucide-react';
import ChannelsToolbar from '@/components/channels/ChannelsToolbar';
import {DeviceTreePanel, useDeviceTreeStore} from "@/core/devices";
import DeviceParams from '@/components/channels/DeviceParams';

/** Пусто, пока ничего не загружено: подсказываем, где выбрать, вместо пустых панелей. */
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center text-neutral-600 dark:text-neutral-400">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <FolderOpen className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Проект не загружен</h2>
        <p className="mt-2 text-sm">
          На панели сверху выберите <Building2 className="inline h-4 w-4 align-text-bottom" /> площадку,
          затем один или несколько проектов и нажмите «Загрузить» — слева появится дерево устройств.
        </p>
        <p className="mt-2 text-xs">
          Нет нужного проекта — импортируйте базу из файла кнопкой «Импорт .cdbx» справа сверху.
        </p>
      </div>
    </div>
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
    <div className="fixed inset-0 top-(--app-header-h) flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
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
        <EmptyState />
      )}
    </div>
  );
}
