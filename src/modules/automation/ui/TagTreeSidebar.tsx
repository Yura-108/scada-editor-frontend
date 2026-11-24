"use client";

import React from "react";
import {DeviceTreePanel} from "@/core/devices";
import {SidePanel} from "./SidePanel";

const SIZE = {min: 220, max: 640, initial: 320};

/**
 * Дерево тегов справа от формы задачи. Ширина и свёрнутость — как у шаблонов (`SidePanel`),
 * ключи памяти в браузере прежние.
 *
 * Раньше дерево стояло колонкой фиксированной ширины и высоты 600px и отнимало место у формы.
 */
export function TagTreeSidebar({overlay}: {overlay: boolean}) {
  return (
    <SidePanel storageKey="automation.tagTree" title="Дерево тегов" size={SIZE} overlay={overlay}>
      <div className="flex-1 min-h-0 p-3 pl-4 pt-2">
        <DeviceTreePanel fill compact />
      </div>
    </SidePanel>
  );
}
