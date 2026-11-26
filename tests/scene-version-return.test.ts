import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCurrentVersion,
  fetchVersions,
  restoreVersionRequest,
  type VersionSummary,
} from '@/core/project';
import { confirmModal } from '@/shared/ui/dialog/confirmModal';
import type { EditorState } from '@/modules/editor/model/editorStore';
import { createVersionsSlice } from '@/modules/editor/model/slices/versions.slice';
import {
  findPreviousVersion,
  loadPreviousVersion,
  rememberReturnedVersion,
} from '@/modules/editor/model/versionHistory';

vi.mock('@/core/project', () => ({
  fetchVersions: vi.fn(),
  fetchCurrentVersion: vi.fn(),
  restoreVersionRequest: vi.fn(),
}));
vi.mock('@/shared/ui/dialog/confirmModal', () => ({ confirmModal: vi.fn() }));
vi.mock('@/modules/editor/model/editorStoreInternals', () => ({
  canWriteCurrentProject: () => true,
  VERSIONS_PAGE_SIZE: 20,
}));
vi.mock('@/modules/editor/model/saveFlow', () => ({
  withSaveLock: (run: () => Promise<boolean>) => run(),
}));

const version = (
  number: number,
  kind: VersionSummary['kind'] = 'MANUAL',
  source?: number,
): VersionSummary => ({
  version_no: number,
  kind,
  user_name: 'tester',
  created_at: `2026-11-25T12:00:${String(number).padStart(2, '0')}Z`,
  ...(source === undefined ? {} : { restored_from: source }),
});

beforeEach(() => vi.resetAllMocks());

describe('Возврат к версии схемы', () => {
  it.each([1, 2])('после восстановления версии %s возвращает версию 5', (source) => {
    const head = version(6, 'RESTORE', source);
    const versions = [head, version(5), version(4), version(2), version(1)];

    expect(findPreviousVersion(versions, head, false)?.version_no).toBe(5);
  });

  it('возвращает снимок перед восстановлением, даже если это автосохранение', () => {
    const head = version(6, 'RESTORE', 2);
    const autosave = version(5, 'AUTOSAVE');

    expect(findPreviousVersion([head, autosave, version(4)], head, false)).toBe(autosave);
  });

  it('при обычном возврате ищет ближайшее ручное сохранение', () => {
    const head = version(6);

    expect(
      findPreviousVersion([head, version(5, 'AUTOSAVE'), version(4)], head, false)?.version_no,
    ).toBe(4);
  });

  it('повторный шаг после возврата продолжает историю ниже выбранной версии', () => {
    const head = version(7, 'RESTORE', 5);
    const versions = [head, version(6, 'RESTORE', 2), version(5), version(4), version(2)];

    expect(findPreviousVersion(versions, head, true)?.version_no).toBe(4);
  });

  it('учитывает источник, если снимок до восстановления сам был восстановлением', () => {
    const head = version(8, 'RESTORE', 6);
    const versions = [
      head,
      version(7, 'RESTORE', 1),
      version(6, 'RESTORE', 3),
      version(5),
      version(3),
      version(2),
    ];

    expect(findPreviousVersion(versions, head, true)?.version_no).toBe(2);
  });

  it('дозагружает более раннее ручное сохранение по курсору', async () => {
    const head = version(7, 'RESTORE', 5);
    const cursor = version(6, 'RESTORE', 2);
    rememberReturnedVersion(42, head.version_no);
    vi.mocked(fetchVersions)
      .mockResolvedValueOnce([head, cursor])
      .mockResolvedValueOnce([cursor, version(5)])
      .mockResolvedValueOnce([version(5), version(4)]);

    expect((await loadPreviousVersion(42, 2)).previous?.version_no).toBe(4);
    expect(fetchVersions).toHaveBeenLastCalledWith('scenes', 42, {
      limit: 2,
      to: version(5).created_at,
    });
  });

  it('не записывает возврат, если подтверждённая версия уже устарела', async () => {
    const head = version(6, 'RESTORE', 2);
    vi.mocked(fetchVersions).mockResolvedValue([head, version(5), version(2)]);
    vi.mocked(confirmModal).mockResolvedValue(true);
    vi.mocked(fetchCurrentVersion).mockResolvedValue(7);
    const slice = createVersionsSlice(vi.fn(), () => state);
    const state = {
      ...slice,
      scene: { id: 7 },
      currentProject: { id: 1 },
      sceneVersion: head.version_no,
    } as EditorState;

    await expect(slice.restorePreviousManualVersion()).resolves.toBe(false);
    expect(confirmModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Вернуться к версии 5?' }),
    );
    expect(restoreVersionRequest).not.toHaveBeenCalled();
  });
});
