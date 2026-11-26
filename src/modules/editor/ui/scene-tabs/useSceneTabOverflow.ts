import { useLayoutEffect, useState, type RefObject } from 'react';

interface MeasuredTab {
  key: string;
  width: number;
}

// Ширина кнопки «Ещё N» соответствует w-24 в SceneTabs.
const MENU_WIDTH = 96;

export function hiddenSceneTabKeys(
  tabs: MeasuredTab[],
  width: number,
  gap: number,
  activeKey: string,
  recipesKey?: string,
): string[] {
  const total = tabs.reduce((sum, tab) => sum + tab.width, 0) + gap * Math.max(0, tabs.length - 1);
  if (total <= width || !tabs.length) return [];

  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const recipes = tabs.find((tab) => tab.key === recipesKey);
  const shown = new Set([active.key]);
  let remaining = width - MENU_WIDTH - gap - active.width;

  for (const tab of recipes ? [recipes, ...tabs] : tabs) {
    if (shown.has(tab.key) || tab.width + gap > remaining) continue;
    shown.add(tab.key);
    remaining -= tab.width + gap;
  }
  return tabs.filter((tab) => !shown.has(tab.key)).map((tab) => tab.key);
}

export function useSceneTabOverflow(
  stripRef: RefObject<HTMLDivElement | null>,
  tabs: readonly { key: string }[],
  enabled: boolean,
  activeKey: string,
  recipesKey?: string,
): string[] {
  const [hidden, setHidden] = useState<string[]>([]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!enabled || !strip) return;
    const nodes = Array.from(strip.querySelectorAll<HTMLElement>('[data-scene-tab]'));
    const measure = () => {
      const style = getComputedStyle(strip);
      const width =
        strip.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const measurements = nodes.map((node) => ({
        key: node.dataset.sceneTab ?? '',
        width: node.getBoundingClientRect().width,
      }));
      const next = hiddenSceneTabKeys(
        measurements,
        width,
        parseFloat(style.columnGap) || 0,
        activeKey,
        recipesKey,
      );
      setHidden((current) =>
        current.length === next.length && current.every((key, i) => key === next[i])
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    nodes.forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [stripRef, tabs, enabled, activeKey, recipesKey]);

  return enabled ? hidden : [];
}
