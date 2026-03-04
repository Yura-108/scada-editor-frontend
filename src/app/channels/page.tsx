'use client';

import StartMenu from '@/components/StartMenu';
import DeviceTreePanel from '@/components/DeviceTreePanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import DeviceParams from '@/components/DeviceParams';

export default function Workspace() {
  const { nodes } = useDeviceStore();

  return (
    <div className="min-h-screen bg-gray-300 text-gray-100">
      <main className="container mx-auto flex flex-col md:flex-row justify-around pt-8 pb-20 gap-6 px-4">
        {nodes && (
          <aside className="transition-all duration-300 ease-in-out basis-full md:basis-[25%] lg:basis-[20%]">
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