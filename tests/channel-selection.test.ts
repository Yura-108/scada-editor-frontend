import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionUserStore } from '@/core/access';
import { fetchDeviceTree } from '@/core/devices/api/deviceTreeApi';
import { useDeviceSelection } from '@/core/devices/model/deviceSelectionStore';
import { useDeviceTreeStore } from '@/core/devices/model/deviceTreeStore';
import { readLoadedProjects, readSelectedDevice } from '@/core/devices/model/loadedProjectsMemory';

vi.mock('@/core/devices/api/deviceTreeApi', () => ({ fetchDeviceTree: vi.fn() }));

const project = 'BN1.Tanks';
const channel = 'BN1.Tanks.TANK1.CLEVEL';
const store = useDeviceTreeStore;
const selection = useDeviceSelection;

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  store.setState(store.getInitialState());
  selection.setState(selection.getInitialState());
  useSessionUserStore.setState({ login: 'operator' });
  vi.mocked(fetchDeviceTree).mockResolvedValue({
    nodes: [{ key: channel, title: 'CLEVEL', parentKey: 'BN1.Tanks.TANK1' }],
    params: [],
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('выбор узла базы каналов', () => {
  it.each([channel, 'BN1'])(
    'восстанавливает доступный узел %s после загрузки дерева',
    async (key) => {
      await store.getState().loadNodes([project]);
      selection.getState().selectDevice(key);
      const savedProjects = readLoadedProjects('operator');
      expect(savedProjects).toEqual([project]);

      selection.setState(selection.getInitialState());
      await store.getState().loadNodes(savedProjects!);

      expect(selection.getState().selectedDevice).toBe(key);
    },
  );

  it('очищает сохранённый узел, которого больше нет в дереве', async () => {
    await store.getState().loadNodes([project]);
    selection.getState().selectDevice(channel);

    vi.mocked(fetchDeviceTree).mockResolvedValueOnce({ nodes: [], params: [] });
    selection.setState(selection.getInitialState());
    await store.getState().loadNodes([project]);

    expect(selection.getState().selectedDevice).toBeNull();
    expect(readSelectedDevice('operator')).toBeNull();
  });

  it('не применяет сохранённый выбор другого пользователя', async () => {
    await store.getState().loadNodes([project]);
    selection.getState().selectDevice(channel);

    selection.setState(selection.getInitialState());
    useSessionUserStore.setState({ login: 'another-operator' });
    await store.getState().loadNodes([project]);

    expect(selection.getState().selectedDevice).toBeNull();
  });
});
