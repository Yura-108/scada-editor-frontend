import React from 'react';
import {ChevronDown, ChevronUp, Search, X} from 'lucide-react';
import {IconButton} from "@/shared/ui/IconButton";
import {cn} from '@/shared/lib/cn';
import {fieldBase, fieldSizes} from '@/shared/ui/field/fieldStyles';


/**
 * Поиск по дереву устройств: поле, счётчик «n / всего» и переход по совпадениям.
 * Что искать и куда переходить, решает панель дерева; здесь только поле и кнопки.
 */
export function TreeSearchBox({query, onQueryChange, onEnter, onEscape, status, notFound, canStep, onStep, onClear}: {
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter (с Shift — назад). */
  onEnter: (back: boolean) => void;
  /** Esc при непустом поле. */
  onEscape: () => void;
  /** Текст счётчика; null — не показывать. */
  status: string | null;
  notFound: boolean;
  /** Совпадений больше одного — показать «назад/вперёд». */
  canStep: boolean;
  onStep: (dir: -1 | 1) => void;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        fieldBase, fieldSizes.sm,
        'mt-2 flex items-center gap-1 px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
      )}
    >
      <Search className="w-4 h-4 shrink-0 text-muted-foreground"/>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter(e.shiftKey);
          } else if (e.key === 'Escape' && query) {
            e.preventDefault();
            e.stopPropagation();
            onEscape();
          }
        }}
        placeholder="Название или путь узла"
        aria-label="Поиск по дереву устройств"
        title="Полное название узла или хвост пути через точку. Enter — следующее совпадение, Shift+Enter — предыдущее, Esc — очистить"
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {status !== null && (
        <span className={cn('text-xs tabular-nums', notFound ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
          {status}
        </span>
      )}
      {canStep && (
        <>
          <IconButton icon={ChevronUp} size="xs" label="Предыдущее совпадение (Shift+Enter)" onClick={() => onStep(-1)} />
          <IconButton icon={ChevronDown} size="xs" label="Следующее совпадение (Enter)" onClick={() => onStep(1)} />
        </>
      )}
      {query && (
        <IconButton icon={X} size="xs" label="Очистить (Esc)" onClick={onClear} />
      )}
    </div>
  );
}
