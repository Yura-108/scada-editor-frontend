'use client';

import { useId, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, CircleHelp, X } from 'lucide-react';
import { toast } from 'sonner';
import { setSectionHelpHidden, useSectionHelpHidden } from '@/shared/lib/sectionHelpVisibility';
import { IconButton } from '../IconButton';
import { usePortalContainer } from '../portalContainer';

export interface SectionHelp {
  title: string;
  body: ReactNode;
  more: ReactNode;
}

export function PageHelp({ help }: { help: SectionHelp }) {
  const hidden = useSectionHelpHidden();
  const container = usePortalContainer();
  const titleId = useId();

  if (hidden) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton icon={CircleHelp} label="Справка по разделу" className="[&_svg]:size-[18px]" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          aria-labelledby={titleId}
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-dropdown flex max-h-[min(60dvh,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
            <h2 id={titleId} className="flex-1 text-sm font-semibold">
              {help.title}
            </h2>
            <Popover.Close asChild>
              <IconButton icon={X} size="xs" label="Свернуть справку" />
            </Popover.Close>
          </div>
          <HelpText key={help.title} help={help} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function HelpText({ help }: { help: SectionHelp }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div className="space-y-2 overflow-y-auto px-4 py-3 text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-xs [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      {help.body}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? 'Свернуть подробности' : 'Подробнее'}
        <ChevronDown size={14} aria-hidden className={expanded ? 'rotate-180' : undefined} />
      </button>
      <div id={detailsId} hidden={!expanded}>
        {help.more}
      </div>
      <div className="border-t border-border pt-2">
        <button
          type="button"
          onClick={() => {
            setSectionHelpHidden(true);
            toast.info('Подсказки скрыты. Их можно вернуть в меню пользователя.');
          }}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Больше не показывать подсказки
        </button>
      </div>
    </div>
  );
}
