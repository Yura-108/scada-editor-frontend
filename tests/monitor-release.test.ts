import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/modules/editor/model/editorStore';

const first = { id: 27, name: 'Без выпуска' };
const second = { id: 28, name: 'С выпуском' };
const unavailable = () =>
  Response.json(
    {
      message: 'Проект 27 не назначен ни одному экземпляру runtime',
    },
    { status: 409 },
  );

afterEach(() => {
  vi.unstubAllGlobals();
  useEditorStore.setState(useEditorStore.getInitialState());
});

describe('Доступность выпуска в мониторе', () => {
  it('сбрасывает признак недоступности при выборе другого проекта', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unavailable()));
    useEditorStore.setState({ currentProject: first, sceneSource: 'release' });

    await useEditorStore.getState().loadSceneList(first.id);
    expect(useEditorStore.getState().releaseUnavailable).toBe(true);

    useEditorStore.getState().setCurrentProject(second);
    expect(useEditorStore.getState().releaseUnavailable).toBe(false);
  });

  it('не применяет 409 от предыдущего проекта к уже загруженному выпуску', async () => {
    const delayed = Promise.withResolvers<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(delayed.promise)
        .mockResolvedValueOnce(Response.json([], { headers: { 'X-Release-Version': '4' } })),
    );
    useEditorStore.setState({ currentProject: first, sceneSource: 'release' });
    const oldLoad = useEditorStore.getState().loadSceneList(first.id);

    useEditorStore.getState().setCurrentProject(second);
    await useEditorStore.getState().loadSceneList(second.id);
    delayed.resolve(unavailable());
    await oldLoad;

    expect(useEditorStore.getState()).toMatchObject({
      currentProject: second,
      releaseUnavailable: false,
      releaseVersionNo: 4,
    });
  });
});
