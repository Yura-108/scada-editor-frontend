"use client";

import React, {useMemo} from "react";
import {Activity, Box, Cpu} from "lucide-react";
import {leafKeysOf, useDeviceSelection, type FlatDeviceNode} from "@/core/devices";
import {countOf} from "@/shared/lib/plural";

/**
 * Карточка узла без своих параметров (площадка, проект, устройство): имя, путь, сколько под
 * ним каналов и список вложенных узлов — щелчок открывает узел. Раньше справа было только
 * «Нет параметров для отображения», и где ты и что внутри, понять было нельзя (#16 п. 6).
 */
export function DeviceCard({node, nodes}: {node: FlatDeviceNode; nodes: FlatDeviceNode[]}) {
  const leaves = useMemo(() => leafKeysOf(nodes), [nodes]);
  const {children, channelCount} = useMemo(() => {
    const prefix = `${node.key}.`;
    const below = nodes.filter((n) => n.key.startsWith(prefix));
    return {
      // Прямые потомки — по пути (ключ = путь через точку), а не по `parentKey`: он не всегда есть.
      children: below.filter((n) => !n.key.slice(prefix.length).includes(".")),
      channelCount: below.filter((n) => leaves.has(n.key)).length,
    };
  }, [node.key, nodes, leaves]);
  const open = (key: string) => useDeviceSelection.getState().selectDevice(key);

  return (
    <div className="min-h-full flex flex-col gap-4 bg-card border border-border rounded-2xl shadow-sm p-6">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Cpu className="h-5 w-5 text-primary" />
          {node.title || node.key.split(".").pop()}
        </h2>
        <p className="mt-1 break-all text-xs text-muted-foreground" title="Полный путь узла">{node.key}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {children.length > 0 ? (
            <>
              {countOf(children.length, "вложенный узел", "вложенных узла", "вложенных узлов")}
              {" · "}
              {countOf(channelCount, "канал", "канала", "каналов")} всего. Своих параметров у узла
              нет — они у каналов.
            </>
          ) : "У узла нет ни параметров, ни вложенных узлов."}
        </p>
      </div>

      {children.length > 0 && (
        <ul className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {children.map((child) => {
            const Icon = leaves.has(child.key) ? Activity : Box;
            return (
              <li key={child.key}>
                <button
                  type="button"
                  onClick={() => open(child.key)}
                  title={child.key}
                  className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{child.title || child.key.split(".").pop()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
