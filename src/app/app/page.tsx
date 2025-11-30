'use client';

import StartMenu from '@/components/StartMenu';
import LogoutButton from '@/components/LogoutButton';
import DeviceTreePanel from '@/components/DeviceTreePanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import DeviceParams from '@/components/DeviceParams';

export default function Workspace() {
  const { nodes, params } = useDeviceStore();
  return (
    <div>
      <div className="mt-auto pt-8 border-t border-gray-200">
        <LogoutButton />
      </div>
      <StartMenu />
      <div className={'h-fit flex justify-around pt-5'}>
        {nodes && <DeviceTreePanel />}
        <DeviceParams />
      </div>
    </div>
  );
}
