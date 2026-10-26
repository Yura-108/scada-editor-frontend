"use client";

import React from "react";
import {usePopupGroups} from "../../model/alarmsStore";
import {AlarmGroupCard} from "./AlarmGroupCard";

interface AlarmPopupsProps {
  projectId: number;
  canAck: boolean;
}

/**
 * Окна новых аварий — стопкой в правом верхнем углу схемы, самые важные сверху. Стопка
 * прокручивается, поэтому ни одна новая авария не уходит за край незамеченной.
 */
export function AlarmPopups({projectId, canAck}: AlarmPopupsProps) {
  const groups = usePopupGroups();
  if (!groups.length) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="absolute right-3 top-3 z-30 w-[400px] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] overflow-y-auto space-y-2 pr-0.5"
    >
      {groups.length > 1 && (
        <div className="text-right text-xs font-medium text-neutral-600 dark:text-neutral-300">
          Новых сообщений ПЛК: {groups.length}
        </div>
      )}
      {groups.map(group => (
        <AlarmGroupCard key={group.groupKey} group={group} projectId={projectId} canAck={canAck} popup />
      ))}
    </div>
  );
}
