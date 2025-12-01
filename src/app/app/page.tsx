'use client';

import StartMenu from '@/components/StartMenu';
import LogoutButton from '@/components/LogoutButton';
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
      <div className="h-screen flex justify-around pt-5">
        {nodes && (
          <div className="transition-all duration-300 ease-in-out">
            <DeviceTreePanel />
          </div>
        )}
        <div className="transition-all duration-300 ease-in-out">
          <DeviceParams />
        </div>
      </div>
    </div>
  );
}
