import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneTabButton } from '@/modules/editor/ui/scene-tabs/SceneTabButton';
import { hiddenSceneTabKeys } from '@/modules/editor/ui/scene-tabs/useSceneTabOverflow';

describe('Вкладки схем, которые уходят в «Ещё»', () => {
  const tabs = [
    { key: 'recipes', width: 100 },
    ...Array.from({ length: 13 }, (_, index) => ({ key: `scene:${index + 1}`, width: 90 })),
  ];

  it('показывает все вкладки, когда полоса достаточно широкая', () => {
    expect(hiddenSceneTabKeys(tabs, 1400, 8, 'scene:13', 'recipes')).toEqual([]);
  });

  it('оставляет активную схему и «Рецепты» на полосе после появления меню', () => {
    const hidden = hiddenSceneTabKeys(tabs, 402, 8, 'scene:13', 'recipes');

    expect(hidden).toEqual(Array.from({ length: 11 }, (_, index) => `scene:${index + 2}`));
  });

  it('оставляет активную вкладку при сильном сужении холста', () => {
    const hidden = hiddenSceneTabKeys(tabs, 168, 8, 'scene:13', 'recipes');

    expect(hidden).toHaveLength(13);
    expect(hidden).not.toContain('scene:13');
  });

  it('оставляет в клавиатурной навигации только видимые вкладки', () => {
    const tab = { key: 'scene:13', label: 'Схема 13', sceneId: 13 };
    const props = {
      tab,
      activeKey: tab.key,
      contentId: 'workspace',
      dirtySceneId: null,
      shrink: false,
      onActivate: () => {},
    };
    const visible = renderToStaticMarkup(
      createElement(SceneTabButton, {
        ...props,
        focusKey: tab.key,
        visibleKeys: [tab.key],
      }),
    );
    const hidden = renderToStaticMarkup(
      createElement(SceneTabButton, {
        ...props,
        visibleKeys: [],
      }),
    );

    expect(visible).toContain('role="tab"');
    expect(visible).toContain('tabindex="0"');
    expect(hidden).not.toContain('role="tab"');
    expect(hidden).toContain('tabindex="-1"');
  });
});
