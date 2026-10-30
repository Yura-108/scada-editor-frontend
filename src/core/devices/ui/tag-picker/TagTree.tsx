"use client";

import React, {useMemo, useState} from "react";
import Tree from "rc-tree";
import type {Key} from "rc-tree/es/interface";
import {Activity, Box, Building2, Cpu, FolderOpen} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import SwitcherIcon from "@/shared/ui/SwitcherIcon";
import {EmptyState} from "@/shared/ui/EmptyState";
import {SearchInput} from "@/shared/ui/field/SearchInput";
import {allTreeKeys, buildDeviceTreeData, leafKeysOf, type DeviceTreeNodeInfo} from "../../lib/deviceTreeData";
import {useDeviceTreeStore} from "../../model/deviceTreeStore";
import ChannelsProjectPicker from "../ChannelsProjectPicker";

/** Иконка узла по глубине пути: площадка, проект, устройство, канал. */
function NodeIcon({depth, isLeaf}: {depth: number; isLeaf: boolean}) {
  const className = "h-4 w-4 shrink-0";
  if (depth === 1) return <Building2 className={cn(className, "text-primary")} />;
  if (depth === 2) return <FolderOpen className={cn(className, "text-warning")} />;
  if (depth === 3) return <Cpu className={cn(className, "text-info")} />;
  return isLeaf
    ? <Activity className={cn(className, "text-tag")} />
    : <Box className={cn(className, "text-muted-foreground")} />;
}

type TagTreeProps = {className?: string} & (
  | {multiple?: false; value: string | null; onChange: (tag: string | null) => void}
  /** Несколько тегов: отметка устройства отмечает всё поддерево, наружу уходят только каналы. */
  | {multiple: true; onChange: (tags: string[]) => void}
);

/**
 * Дерево тегов для выбора: поиск по пути и выбор канала (конечного узла — у устройства
 * значения нет). Выделение своё: общее выделение страницы «База каналов»
 * (`selectedDevice`) не трогается. Дерево пусто — здесь же выбор площадки и проекта.
 */
export function TagTree(props: TagTreeProps) {
  const nodes = useDeviceTreeStore((s) => s.nodes);
  const [query, setQuery] = useState("");
  // Отмеченные ключи в режиме «несколько» — вместе с папками, чтобы дерево показывало их галочки.
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  // Дерево тысячное: фильтруем плоский список ДО сборки дерева — промежуточные узлы
  // достроятся из путей выживших листьев.
  const visibleNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((n) => n.key.toLowerCase().includes(needle));
  }, [nodes, query]);

  const treeData = useMemo(
    () => buildDeviceTreeData(visibleNodes, (info: DeviceTreeNodeInfo) => (
      <span className="inline-flex items-center gap-2 py-0.5" title={info.key}>
        <NodeIcon depth={info.key.split(".").length} isLeaf={info.isLeaf} />
        <span className="text-sm">{info.title}</span>
      </span>
    )),
    [visibleNodes],
  );

  const leafKeys = useMemo(() => leafKeysOf(nodes), [nodes]);
  // `rc-tree` пересчитывает отметки по ВИДИМОМУ дереву, поэтому отметки, сделанные до
  // фильтра, сохраняем руками: иначе «нашёл — отметил — очистил поиск — отметил ещё» тихо
  // теряло бы первую половину выбора.
  const visibleKeys = useMemo(() => allTreeKeys(visibleNodes), [visibleNodes]);

  if (nodes.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center", props.className)}>
        <p className="text-sm text-muted-foreground">
          Дерево устройств не загружено. Выберите площадку и проект базы каналов:
        </p>
        <ChannelsProjectPicker layout="stacked" />
      </div>
    );
  }

  const check = (keys: Key[]) => {
    if (!props.multiple) return;
    const next = [...checkedKeys.filter((k) => !visibleKeys.has(k)), ...(keys as string[])];
    setCheckedKeys(next);
    props.onChange(next.filter((key) => leafKeys.has(key)));
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", props.className)}>
      <SearchInput
        size="sm"
        className="shrink-0"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по пути тега"
      />
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar rounded-lg border bg-background px-2 py-3">
        {treeData.length === 0 ? (
          <EmptyState size="sm" title="Ничего не найдено" className="py-10" />
        ) : props.multiple ? (
          <Tree
            treeData={treeData}
            checkable
            selectable={false}
            showLine={false}
            showIcon={false}
            switcherIcon={SwitcherIcon}
            checkedKeys={checkedKeys}
            onCheck={(keys) => check(Array.isArray(keys) ? keys : keys.checked)}
            className="custom-tree"
          />
        ) : (
          <Tree
            treeData={treeData}
            showLine={false}
            showIcon={false}
            switcherIcon={SwitcherIcon}
            selectedKeys={props.value ? [props.value] : []}
            // Ветку выбрать нельзя: значение есть только у конечного узла.
            onSelect={(keys: Key[]) => {
              const key = keys[0] as string | undefined;
              if (key && leafKeys.has(key)) props.onChange(key);
            }}
            className="custom-tree"
          />
        )}
      </div>
    </div>
  );
}
