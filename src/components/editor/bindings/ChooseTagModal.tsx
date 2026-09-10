"use client";

import React, {useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Tree from "rc-tree";
import type {Key} from "rc-tree/es/interface";
import {Activity, AlertTriangle, Box, Building2, Cpu, FolderOpen, Search} from "lucide-react";
import {cn} from "@/lib/utils";
import SwitcherIcon from "@/components/ui/SwitcherIcon";
import {Button, ModalFooter} from "@/components/ui/Button";
import {useDeviceStore} from "@/store/useDeviceStore";
import {buildDeviceTreeData, leafKeysOf, type DeviceTreeNodeInfo} from "@/lib/editor/deviceTreeData";
import {shortTagPath} from "@/lib/editor/tagPath";

/**
 * Выбор ОДНОГО тега — для прямой привязки «значение элемента ← тег».
 *
 * Вложенный диалог со своим `Dialog.Root` и `z-modal-nested`, как
 * `ChooseObjectPropertyModal`: панель свойств уже живёт внутри своего окна, а
 * `useModalStore` одноместный и подменил бы её.
 *
 * Выбор одиночный и НЕ трогает `useDeviceStore.selectedDevice`: тот глобальный и общий
 * со страницей «База каналов» — выбор тега здесь не должен менять выделение там.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (tagId: string) => void;
}

/** Иконка узла по глубине пути — та же логика, что в дереве базы каналов. */
function NodeIcon({depth, isLeaf}: {depth: number; isLeaf: boolean}) {
  const className = "h-4 w-4 shrink-0";
  if (depth === 1) return <Building2 className={cn(className, "text-indigo-500")} />;
  if (depth === 2) return <FolderOpen className={cn(className, "text-amber-500")} />;
  if (depth === 3) return <Cpu className={cn(className, "text-sky-500")} />;
  return isLeaf
    ? <Activity className={cn(className, "text-emerald-500")} />
    : <Box className={cn(className, "text-gray-400")} />;
}

export function ChooseTagModal({open, onClose, onPick}: Props) {
  const nodes = useDeviceStore((s) => s.nodes);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visibleNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((n) => n.key.toLowerCase().includes(needle));
  }, [nodes, query]);

  const treeData = useMemo(
    () => buildDeviceTreeData(visibleNodes, (info: DeviceTreeNodeInfo) => (
      <span className="inline-flex items-center gap-2 py-0.5" title={info.key}>
        <NodeIcon depth={info.key.split(".").length} isLeaf={info.isLeaf} />
        <span className="text-sm text-gray-800 dark:text-gray-200">{info.title}</span>
      </span>
    )),
    [visibleNodes],
  );

  // Тег — только конечный узел: у устройства значения нет.
  const leafKeys = useMemo(() => leafKeysOf(nodes), [nodes]);
  const isTreeEmpty = nodes.length === 0;

  const close = () => {
    setSelected(null);
    setQuery("");
    onClose();
  };

  const handleConfirm = () => {
    if (!selected) return;
    onPick(selected);
    close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal-nested bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-modal-nested -translate-x-1/2 -translate-y-1/2",
            "w-[95vw] max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl",
            "bg-white dark:bg-[#0f0f1a] text-gray-900 dark:text-white",
            "border border-gray-200 dark:border-gray-800/70 shadow-2xl shadow-black/50 p-6",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="text-lg font-semibold mb-1">Привязка к тегу</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Значение элемента будет следовать за выбранным тегом. Собственных свойств
            элементу для этого не нужно.
          </Dialog.Description>

          {isTreeEmpty ? (
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="max-w-md rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Дерево устройств пусто. Откройте раздел «База каналов» и загрузите проект —
                  без него не из чего выбирать теги.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-600 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по пути тега"
                  className={cn(
                    "w-full rounded-xl border bg-white dark:bg-gray-900/80",
                    "border-gray-300 dark:border-gray-700/80",
                    "py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100",
                    "placeholder:text-gray-400 dark:placeholder:text-gray-600",
                    "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
                    "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all",
                  )}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/70 px-2 py-3">
                {treeData.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ничего не найдено
                  </div>
                ) : (
                  <Tree
                    treeData={treeData}
                    showLine={false}
                    showIcon={false}
                    switcherIcon={SwitcherIcon}
                    selectedKeys={selected ? [selected] : []}
                    // Ветку выбрать нельзя: значение есть только у конечного узла.
                    onSelect={(keys: Key[]) => {
                      const key = keys[0] as string | undefined;
                      if (key && leafKeys.has(key)) setSelected(key);
                    }}
                    className="custom-tree"
                  />
                )}
              </div>

              <p className="shrink-0 text-xs text-gray-500 dark:text-gray-500 truncate" title={selected ?? undefined}>
                {selected
                  ? `Выбран тег: ${shortTagPath(selected)}`
                  : "Выберите конечный узел дерева — у ветки значения нет."}
              </p>
            </div>
          )}

          <ModalFooter className="shrink-0 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800/80">
            <Button onClick={close}>Отмена</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!selected}>
              Привязать
            </Button>
          </ModalFooter>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
