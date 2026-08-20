'use client';

import { useEffect } from 'react';
import StartMenu from '@/components/channels/StartMenu';
import DeviceTreePanel from '@/components/channels/DeviceTreePanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import DeviceParams from '@/components/channels/DeviceParams';

export default function Workspace() {
  const { nodes } = useDeviceStore();

  // При входе в базу каналов подхватываем изменения (например, отмену действия в логах),
  // если данные были помечены устаревшими.
  useEffect(() => {
    void useDeviceStore.getState().refreshIfStale();
  }, []);

  return (
    <div className="min-h-app bg-gray-100 dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
      <main className="container mx-auto flex flex-col md:flex-row justify-around pt-8 pb-20 gap-6 px-8">
        {nodes && (
          <aside className="transition-all duration-300 ease-in-out basis-full md:basis-[25%] lg:basis-[20%] md:sticky md:top-8 md:self-start">
            <DeviceTreePanel />
          </aside>
        )}
        <section className="transition-all duration-300 ease-in-out flex-1">
          <DeviceParams />
        </section>
      </main>

      <StartMenu />
    </div>
  );
}