'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Tree from 'rc-tree';
import {Key} from 'rc-tree/es/interface';
import {Router} from 'lucide-react';
import TitleRenderer from "./TitleRenderer";
import SwitcherIcon from '@/shared/ui/SwitcherIcon';
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import ContextMenu from "./DeviceContextMenu";
import {nodeMenuItems} from "./contextMenuItems";
import {ContextMenuTrigger, ContextMenuType} from "../types/contextMenu.type";
import {ancestorKeysOf, buildDeviceTreeData, countDevicesAndChannels} from "../lib/deviceTreeData";
import ChannelsProjectPicker from "./ChannelsProjectPicker";
import {handleContextAction} from "../model/deviceActions";
import {useDeviceTreeStore} from "../model/deviceTreeStore";
import {useDeviceSelection} from "../model/deviceSelectionStore";
import {TreeSearchBox} from "./TreeSearchBox";
import {countOf} from "@/shared/lib/plural";
import {useDeviceTreeSearch} from "./useDeviceTreeSearch";

interface DeviceTreePanelProps {
  /** Занять всю высоту родителя вместо собственной (встроенная панель, а не отдельная страница). */
  fill?: boolean;
  /**
   * Без крупного заголовка «Дерево устройств» — у колонки уже есть свой («Дерево тегов» в
   * «Автоматизации»): два заголовка подряд отнимали место в узкой колонке (#7 п. 4).
   */
  compact?: boolean;
}

const DeviceTreePanel = ({fill = false, compact = false}: DeviceTreePanelProps) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);
  const {
    nodes,
    isLoadingNodes,
    nodesError,
    loadedRootPath,
    loadNodes,
  } = useDeviceTreeStore();
  const selectedDevice = useDeviceSelection(s => s.selectedDevice);

  // Раскрытие управляемое: поиск должен раскрывать предков найденного узла, не сворачивая
  // того, что пользователь уже раскрыл руками.
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  // Узел под «курсором» клавиатуры rc-tree: стрелки водят его, Enter открывает. Управляемый —
  // щелчок по узлу ставит курсор на него, и стрелки идут от него (#16 п. 10).
  const [activeKey, setActiveKey] = useState<Key | null>(null);
  // Узел, к которому надо прокрутить после раскрытия; счётчик — чтобы повторный переход
  // к тому же узлу тоже прокручивал.
  const [scrollTarget, setScrollTarget] = useState<{key: string; seq: number} | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((keys: Key[]) => {
    const key = keys[0] as string | undefined;
    if (key) useDeviceSelection.getState().selectDevice(key);
  }, []);

  const handleNodeClick = useCallback((nodeKey: string) => {
    useDeviceSelection.getState().selectDevice(nodeKey);
    // Щелчок по строке не даёт фокус дереву (у rc-tree клавиатура живёт в скрытом поле), и
    // стрелки после щелчка не листали дерево. Фокус — туда, курсор — на щёлкнутый узел.
    setActiveKey(nodeKey);
    scrollBoxRef.current?.querySelector<HTMLInputElement>('.rc-tree input')?.focus({preventScroll: true});
  }, []);

  const handleContextMenu = useCallback(
    (e: ContextMenuTrigger, node: {key: string} | null) => {
      e.preventDefault();
      e.stopPropagation();

      if (node) {
        handleSelect([node.key]);

        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          key: node.key,
        });
      } else {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          key: null
        })
      }

    },
    [handleSelect, setContextMenu] // зависимости
  );

  /** Раскрывает путь до узла и просит прокрутить к нему. */
  const reveal = (key: string) => {
    setExpandedKeys(prev => Array.from(new Set([...prev, ...ancestorKeysOf(key)])));
    setScrollTarget(prev => ({key, seq: (prev?.seq ?? 0) + 1}));
  };
  const search = useDeviceTreeSearch({
    nodes,
    selected: selectedDevice,
    reveal,
    open: (key) => { handleSelect([key]); setActiveKey(key); },
  });
  const activeMatch = search.activeMatch;

  // Дерево строит общий билдер: то же знание «ключ = путь через точку» использует
  // модалка выбора тегов для рецепта (src/core/devices/lib/deviceTreeData.ts).
  const treeData = useMemo(
    () => buildDeviceTreeData(nodes, (info) => (
      <TitleRenderer
        node={{key: info.key, title: info.title, isLeaf: info.isLeaf}}
        onClick={() => handleNodeClick(info.key)}
        onContextMenu={handleContextMenu}
        highlighted={info.key === activeMatch}
      />
    )),
    [handleContextMenu, handleNodeClick, nodes, activeMatch],
  );


  // Прокрутка — после того, как раскрытые предки отрендерились. rc-tree без `height`
  // не виртуализирует список, так что строка узла уже есть в DOM.
  useEffect(() => {
    if (!scrollTarget) return;
    const frame = requestAnimationFrame(() => {
      const row = scrollBoxRef.current?.querySelector(`[data-tree-key="${CSS.escape(scrollTarget.key)}"]`);
      row?.scrollIntoView({block: 'center', behavior: 'smooth'});
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollTarget]);

  const {deviceCount, channelCount} = useMemo(() => countDevicesAndChannels(nodes), [nodes]);

  // Стрелки клавиатуры: курсор ушёл за край видимого — подтянуть строку в поле зрения.
  useEffect(() => {
    if (activeKey == null) return;
    const row = scrollBoxRef.current?.querySelector(`[data-tree-key="${CSS.escape(String(activeKey))}"]`);
    row?.scrollIntoView({block: 'nearest'});
  }, [activeKey]);

  return (
    <div className={`${fill ? 'h-full' : 'h-[60vh] md:h-app'} bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
      <div className="px-4 py-3 border-b border-border">
        {!compact && (
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Router className={'w-5 h-5 text-primary'}/>
            Дерево устройств
          </h2>
        )}
        <p className={`text-xs text-muted-foreground ${compact ? '' : 'mt-0.5'}`}>
          {isLoadingNodes ? 'Загрузка…' : `${countOf(deviceCount, 'устройство', 'устройства', 'устройств')} • ${countOf(channelCount, 'канал', 'канала', 'каналов')}`}
        </p>

        <TreeSearchBox
          query={search.query}
          onQueryChange={search.handleQueryChange}
          // Enter открывает найденный узел; дальше — переход по совпадениям (useDeviceTreeSearch).
          onEnter={search.enter}
          onEscape={search.clear}
          status={search.status}
          notFound={!search.matches.length}
          canStep={search.matches.length > 1}
          onStep={search.goToMatch}
          onClear={search.clear}
        />
      </div>

      <div
        ref={scrollBoxRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {/* Раньше во время загрузки дерево показывало «0 устройств • 0 каналов»,
            а ошибка загрузки была видна только в консоли. */}
        {isLoadingNodes ? (
          <div className="space-y-2 px-2" aria-busy="true" aria-label="Загрузка дерева устройств">
            {Array.from({length: 8}).map((_, i) => (
              <div
                key={i}
                className="h-6 rounded bg-muted animate-pulse"
                style={{width: `${90 - (i % 4) * 15}%`}}
              />
            ))}
          </div>
        ) : nodesError ? (
          <Banner tone="destructive" title="Не удалось загрузить дерево устройств" className="mx-2">
            <p className="break-words">{nodesError}</p>
            {loadedRootPath && (
              <Button size="sm" className="mt-3" onClick={() => void loadNodes(loadedRootPath)}>
                Повторить
              </Button>
            )}
          </Banner>
        ) : treeData.length === 0 ? (
          fill ? (
            // Встроенное дерево («Автоматизация», выбор тега): выбор проекта прямо здесь, а не
            // отсылка в другой раздел.
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
              <p>Дерево пусто — загрузите площадку и проект:</p>
              <ChannelsProjectPicker layout="stacked" />
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Дерево пусто — выберите площадку и проект на панели сверху.
            </div>
          )
        ) : (
          <Tree
            treeData={treeData}
            showLine={false}
            showIcon={false}
            switcherIcon={SwitcherIcon}
            selectedKeys={selectedDevice ? [selectedDevice] : []}
            onSelect={handleSelect}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            activeKey={activeKey}
            onActiveChange={setActiveKey}
            autoExpandParent={false}
            className="custom-tree"
          />
        )}

        {/* Контекстное меню */}
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            items={nodeMenuItems}
            onAction={(action) => handleContextAction(action, contextMenu.key)}
            onClose={() => setContextMenu(null)}/>
        )}
      </div>
    </div>
  );
};

export default DeviceTreePanel;
