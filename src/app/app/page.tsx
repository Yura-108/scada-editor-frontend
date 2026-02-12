'use client';

import StartMenu from '@/components/StartMenu';
import LogoutButton from '@/components/ui/LogoutButton';
import DeviceTreePanel from '@/components/DeviceTreePanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import DeviceParams from '@/components/DeviceParams';

export default function Workspace() {
  const { nodes } = useDeviceStore();
  return (
    <div>
      <div className="mt-auto pt-8 border-t border-gray-200">
        <LogoutButton />
      </div>
      <StartMenu />
      <div className="min-h-screen container mx-auto flex flex-col md:flex-row justify-around pt-8 pb-20 gap-6">
        {nodes && (
          <div className="transition-all duration-300 ease-in-out basis-[20%]">
            <DeviceTreePanel />
          </div>
        )}
        <div className="transition-all duration-300 ease-in-out basis-[80%]">
          <DeviceParams />
        </div>
      </div>
    </div>
  );
}
