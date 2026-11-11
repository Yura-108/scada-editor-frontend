"use client";

import React, {useMemo, useState} from "react";
import Tree from "rc-tree";
import type {DataNode, Key} from "rc-tree/es/interface";
import {Activity, Box, Building2, Cpu, FolderOpen} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import SwitcherIcon from "@/shared/ui/SwitcherIcon";
import {EmptyState} from "@/shared/ui/EmptyState";
import {Spinner} from "@/shared/ui/Spinner";
import {ancestorsOf, childrenIndex, coveringBranch, type CatalogNode} from "../lib/branchPaths";
import type {CatalogTree} from "./useCatalogTree";

function NodeIcon({depth, isLeaf}: {depth: number; isLeaf: boolean}) {
  const className = "h-4 w-4 shrink-0";
  if (depth === 1) return <Building2 className={cn(className, "text-primary")} />;
  if (depth === 2) return <FolderOpen className={cn(className, "text-warning")} />;
  if (depth === 3) return <Cpu className={cn(className, "text-info")} />;
  return isLeaf
    ? <Activity className={cn(className, "text-tag")} />
    : <Box className={cn(className, "text-muted-foreground")} />;
}

interface Props {
  tree: CatalogTree;
  branches: string[];
  onCheck: (key: string, checked: boolean) => void;
  className?: string;
}

/**
 * Дерево базы каналов с галочками веток (#19 п. 2). Отметка узла — ветка: узел и всё под ним.
 * Узлы под отмеченной веткой показаны отмеченными и неактивными — их покрывает ветка выше,
 * снять можно только её. У предков ветки галочка частичная.
 */
export function BranchTree({tree, branches, onCheck, className}: Props) {
  const {nodes, loaded, sitesLoaded, loadChildren} = tree;
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  const treeData = useMemo(() => {
    const index = childrenIndex(nodes.values());
    const build = (node: CatalogNode): DataNode => {
      const children = index.get(node.key);
      const isLeaf = loaded.has(node.key) && !children;
      const depth = node.key.split(".").length;
      const covering = coveringBranch(node.key, branches);
      return {
        key: node.key,
        isLeaf,
        disableCheckbox: covering !== undefined && covering !== node.key,
        title: (
          <span className="inline-flex items-center gap-2 py-0.5" title={node.key}>
            <NodeIcon depth={depth} isLeaf={isLeaf} />
            <span className="text-sm">{node.title}</span>
          </span>
        ),
        children: children?.map(build),
      };
    };
    return (index.get("") ?? []).map(build);
  }, [nodes, loaded, branches]);

  const checkedKeys = useMemo(() => {
    const checked = [...nodes.keys()].filter(key => coveringBranch(key, branches) !== undefined);
    const halfChecked = [...new Set(branches.flatMap(ancestorsOf))];
    return {checked, halfChecked};
  }, [nodes, branches]);

  if (!sitesLoaded) return <Spinner label="Загрузка базы каналов…" />;
  if (treeData.length === 0) {
    return <EmptyState size="sm" title="В базе каналов нет площадок" className={cn("py-10", className)} />;
  }

  return (
    <div className={cn("min-h-0 overflow-y-auto custom-scrollbar rounded-lg border bg-background px-2 py-3", className)}>
      <Tree
        treeData={treeData}
        checkable
        checkStrictly
        selectable={false}
        showLine={false}
        showIcon={false}
        switcherIcon={SwitcherIcon}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        autoExpandParent={false}
        loadedKeys={[...loaded]}
        loadData={node => loadChildren(String(node.key))}
        checkedKeys={checkedKeys}
        onCheck={(_, info) => onCheck(String(info.node.key), info.checked)}
        className="custom-tree"
      />
    </div>
  );
}
