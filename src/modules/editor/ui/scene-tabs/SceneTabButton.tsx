import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { handleTabListKey } from '@/shared/lib/tabListKeys';

interface SceneTabButtonProps {
  tab: { key: string; label: string; icon?: LucideIcon; sceneId: number | null };
  activeKey: string;
  focusKey?: string;
  visibleKeys: string[];
  dirtySceneId: number | null;
  contentId: string;
  shrink: boolean;
  dragListeners?: Record<string, unknown>;
  onActivate: (key: string) => void;
}

export function SceneTabButton(props: SceneTabButtonProps) {
  const {
    tab,
    activeKey,
    focusKey,
    visibleKeys,
    dirtySceneId,
    contentId,
    shrink,
    dragListeners,
    onActivate,
  } = props;
  const isActive = activeKey === tab.key;
  const visible = visibleKeys.includes(tab.key);
  return (
    <button
      id={`scene-tab-${tab.key}`}
      role={visible ? 'tab' : undefined}
      type="button"
      aria-selected={visible ? isActive : undefined}
      aria-controls={visible ? contentId : undefined}
      tabIndex={tab.key === focusKey ? 0 : -1}
      onClick={() => onActivate(tab.key)}
      onKeyDown={(e) => handleTabListKey(e, visibleKeys, activeKey, onActivate)}
      title={tab.sceneId !== null ? tab.label : undefined}
      className={cn(
        'shrink-0 max-w-48 inline-flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap',
        shrink && 'min-w-0 shrink',
        dragListeners && 'cursor-grab active:cursor-grabbing',
        isActive
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent',
      )}
      {...dragListeners}
    >
      {tab.icon && <tab.icon size={14} className="mr-1.5 shrink-0" aria-hidden />}
      <span className="truncate">{tab.label}</span>
      {tab.sceneId !== null && tab.sceneId === dirtySceneId && (
        <span className="ml-1 text-warning" title="Есть несохранённые изменения">
          •<span className="sr-only"> (есть несохранённые изменения)</span>
        </span>
      )}
    </button>
  );
}
