'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Tree from 'rc-tree';
import {Key} from 'rc-tree/es/interface';
import {Router} from 'lucide-react';
import TitleRenderer from "./TitleRenderer";
import {DeviceNodeType} from '@/types/nodeTypes';
import SwitcherIcon from '@/shared/ui/SwitcherIcon';
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import ContextMenu from "./DeviceContextMenu";
import {nodeMenuItems} from "@/constants/contextMenuItems";
import {ContextMenuTrigger, ContextMenuType} from "@/types/contextMenu.type";
import {ancestorKeysOf, buildDeviceTreeData, findTreeMatches} from "../lib/deviceTreeData";
import ChannelsProjectPicker from "./ChannelsProjectPicker";
import {handleContextAction} from "../model/deviceActions";
import {useDeviceTreeStore} from "../model/deviceTreeStore";
import {TreeSearchBox} from "./TreeSearchBox";

/** Пауза после последнего символа, прежде чем искать: дерево не раскрывается на каждую букву. */
const SEARCH_DEBOUNCE_MS = 250;

interface DeviceTreePanelProps {
  /** Занять всю высоту родителя вместо собственной (встроенная панель, а не отдельная страница). */
  fill?: boolean;
}

const DeviceTreePanel = ({fill = false}: DeviceTreePanelProps) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);
  const {
    nodes,
    selectedDevice,
    isLoadingNodes,
    nodesError,
    loadedRootPath,
    loadNodes,
  } = useDeviceTreeStore();

  // Раскрытие управляемое: поиск должен раскрывать предков найденного узла, не сворачивая
  // того, что пользователь уже раскрыл руками.
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [query, setQuery] = useState('');
  // Запрос, по которому реально искали (после паузы или по Enter).
  const [appliedQuery, setAppliedQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  // Узел, к которому надо прокрутить после раскрытия; счётчик — чтобы повторный переход
  // к тому же узлу тоже прокручивал.
  const [scrollTarget, setScrollTarget] = useState<{key: string; seq: number} | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((keys: Key[]) => {
    const key = keys[0] as string | undefined;
    if (key) useDeviceTreeStore.setState({selectedDevice: key});
  }, []);

  const handleNodeClick = (nodeKey: string) => {
    useDeviceTreeStore.setState({selectedDevice: nodeKey});
  };

  const handleContextMenu = useCallback(
    (e: ContextMenuTrigger, node: DeviceNodeType | null) => {
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

  // Структура для поиска — без подписей: дерево с подписями пересобирается при смене
  // подсвеченного узла, а совпадения от подсветки не зависят.
  const searchTree = useMemo(() => buildDeviceTreeData(nodes, () => null), [nodes]);
  const matches = useMemo(() => findTreeMatches(searchTree, appliedQuery), [searchTree, appliedQuery]);
  const activeMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : null;

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
    [handleContextMenu, nodes, activeMatch],
  );

  /** Раскрывает путь до узла и просит прокрутить к нему. */
  const reveal = (key: string) => {
    setExpandedKeys(prev => Array.from(new Set([...prev, ...ancestorKeysOf(key)])));
    setScrollTarget(prev => ({key, seq: (prev?.seq ?? 0) + 1}));
  };

  const runSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const found = findTreeMatches(searchTree, text);
    setAppliedQuery(text);
    setMatchIndex(0);
    if (found.length) reveal(found[0]);
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim() === '') {
      setAppliedQuery('');
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS);
  };

  const goToMatch = (delta: number) => {
    if (!matches.length) return;
    const next = (Math.min(matchIndex, matches.length - 1) + delta + matches.length) % matches.length;
    setMatchIndex(next);
    reveal(matches[next]);
  };

  const clearSearch = () => handleQueryChange('');

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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

  // Ключи — это пути через точку (площадка.проект.устройство.канал), а тип узла
  // определяется его глубиной: L1 — площадка, L2 — проект, L3 — устройство,
  // L4+ — подустройства (узлы с детьми) и каналы/сигналы (листья).
  const {deviceCount, channelCount} = useMemo(() => {
    // Узел — лист, если ни один другой узел не ссылается на него как на родителя.
    const parentKeys = new Set(nodes.map((n) => n.parentKey).filter(Boolean));
    const depthOf = (key: string) => key.split('.').length;

    let devices = 0;
    let channels = 0;
    nodes.forEach((n) => {
      const depth = depthOf(n.key);
      const isLeaf = !parentKeys.has(n.key);

      if (depth >= 4 && isLeaf) {
        channels += 1; // конечный сигнал/канал
      } else if (depth >= 3) {
        devices += 1; // главное устройство или подустройство
      }
      // depth 1..2 — площадка/проект, в счётчики не входят
    });

    return {deviceCount: devices, channelCount: channels};
  }, [nodes]);

  const searchPending = query.trim() !== '' && query !== appliedQuery;
  const searchActive = appliedQuery.trim() !== '';

  return (
    <div className={`${fill ? 'h-full' : 'h-[60vh] md:h-app'} bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Router className={'w-5 h-5 text-indigo-600 dark:text-indigo-400'}/>
          Дерево устройств
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {isLoadingNodes ? 'Загрузка…' : `${deviceCount} устройств • ${channelCount} каналов`}
        </p>

        <TreeSearchBox
          query={query}
          onQueryChange={handleQueryChange}
          // Enter до истечения паузы ищет сразу; дальше — переход по совпадениям.
          onEnter={(back) => { if (searchPending) runSearch(query); else goToMatch(back ? -1 : 1); }}
          onEscape={clearSearch}
          status={searchActive && !searchPending
            ? (matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} / ${matches.length}` : 'не найдено')
            : null}
          notFound={!matches.length}
          canStep={matches.length > 1}
          onStep={goToMatch}
          onClear={clearSearch}
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
                className="h-6 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse"
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
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Дерево пусто — загрузите площадку и проект:</p>
              <ChannelsProjectPicker layout="stacked" />
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
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
