import { DeviceNodeType} from '@/types/nodeTypes';

export const treeSearch = (key: string, devices: DeviceNodeType[]) => {
  if (key.startsWith('cha')) return [key];
  if (key.startsWith('sub')) {
    const channels = devices.filter(device => device?.parentKey === key).map(device => device.key);
    return channels.concat(key);
  }
  if (key.startsWith('dev')) {
    let res: string[] = [];
    const subtypes = devices.filter(device => device?.parentKey === key);

    subtypes.forEach(subtype => {
      const channels = devices.filter(device => device?.parentKey === subtype.key).map(device => device.key);
      res = res.concat(channels);
    });

    return res.concat(subtypes.map(subtype => subtype.key), key);
  }
}