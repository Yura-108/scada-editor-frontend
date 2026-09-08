"use client";

import React, {useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Tree from "rc-tree";
import type {Key} from "rc-tree/es/interface";
import {Activity, AlertTriangle, Box, Building2, Cpu, FolderOpen, Search} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import SwitcherIcon from "@/components/ui/SwitcherIcon";
import {Button, ModalFooter} from "@/components/ui/Button";
import {useModalStore} from "@/store/modalStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {useEditorStore} from "@/store/useEditorStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {allTreeKeys, buildDeviceTreeData, leafKeysOf, type DeviceTreeNodeInfo} from "@/lib/editor/deviceTreeData";
import {buildRecipeTableRows} from "@/lib/editor/tagMeta";
import {shortTagPath} from "@/lib/editor/tagPath";

interface Props {
  /** Показать созданную таблицу на холсте (переключение вкладки живёт в WorkSpace). */
  onCreated?: (elementKey: string, componentId: number) => void;
}

/** Этапы создания — их три, и каждый заметно небыстрый, поэтому подписываем. */
type Stage = null | "building" | "saving" | "creating";

const STAGE_LABEL: Record<NonNullable<Stage>, string> = {
  building: "Собираем таблицу…",
  saving: "Сохраняем сцену…",
  creating: "Создаём рецепт…",
};

/** Иконка узла по глубине пути — та же логика, что в TitleRenderer базы каналов. */
function NodeIcon({depth, isLeaf}: {depth: number; isLeaf: boolean}) {
  const className = "h-4 w-4 shrink-0";
  if (depth === 1) return <Building2 className={cn(className, "text-indigo-500")} />;
  if (depth === 2) return <FolderOpen className={cn(className, "text-amber-500")} />;
  if (depth === 3) return <Cpu className={cn(className, "text-sky-500")} />;
  return isLeaf
    ? <Activity className={cn(className, "text-emerald-500")} />
    : <Box className={cn(className, "text-gray-400")} />;
}

/** Свободное имя вида «Рецепт N» — модалка имени не спрашивает. */
function nextRecipeName(taken: ReadonlySet<string>): string {
  for (let i = 1; ; i++) {
    const name = `Рецепт ${i}`;
    if (!taken.has(name)) return name;
  }
}

function CreateRecipeTableModalContent({onCreated}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const nodes = useDeviceStore((s) => s.nodes);
  const params = useDeviceStore((s) => s.params);
  const createRecipeTable = useEditorStore((s) => s.createRecipeTable);
  const exportScene = useEditorStore((s) => s.exportScene);
  const createRecipe = useRecipeStore((s) => s.createRecipe);

  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>(null);

  // Дерево тысячное — без фильтра выбрать десяток тегов мучительно. Фильтруем плоский
  // список ДО сборки дерева: промежуточные узлы достроятся из путей выживших листьев.
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

  // `rc-tree` пересчитывает отмеченные ключи по ВИДИМОМУ дереву, поэтому отметки,
  // сделанные до фильтра, надо сохранять руками: иначе «нашёл — отметил — очистил
  // поиск — отметил ещё» тихо теряло бы первую половину выбора.
  const visibleKeys = useMemo(() => allTreeKeys(visibleNodes), [visibleNodes]);
  const handleCheck = (next: string[]) => {
    setCheckedKeys((prev) => [...prev.filter((k) => !visibleKeys.has(k)), ...next]);
  };

  // Тег — только конечный узел. Галочка на устройстве отмечает всё поддерево, и это
  // самый быстрый способ набрать десяток тегов; в таблицу же попадают только листья.
  const leafKeys = useMemo(() => leafKeysOf(nodes), [nodes]);
  const selectedTags = useMemo(
    () => checkedKeys.filter((key) => leafKeys.has(key)),
    [checkedKeys, leafKeys],
  );

  const isBusy = stage !== null;
  const isTreeEmpty = nodes.length === 0;
  const canConfirm = selectedTags.length > 0 && !isBusy;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setStage("building");
    try {
      const rows = buildRecipeTableRows(selectedTags, params);

      const {recipes} = useRecipeStore.getState();
      const taken = new Set<string>([
        ...recipes.map((r) => r.name),
        ...useEditorStore.getState().elements.map((el) => el.label ?? ""),
      ]);
      const name = nextRecipeName(taken);

      const elementKey = createRecipeTable(rows, name);
      if (!elementKey) return;

      // Рецепт привязывается к серверному id таблицы (`component_id` обязателен), а он
      // появляется только после сохранения сцены. 409 exportScene разруливает сам —
      // открывает диалог слияния; таблица при этом уже лежит на холсте.
      setStage("saving");
      const saved = await exportScene({kind: "MANUAL"});
      if (!saved) {
        toast.warning("Таблица создана, но сцена не сохранена — рецепт не заведён", {
          description: "Сохраните сцену и создайте рецепт для этой таблицы кнопкой в панели.",
          duration: 8_000,
        });
        closeModal();
        return;
      }

      // Ключи элементов переживают серверный круг (см. applyServerComponents).
      const componentId = useEditorStore.getState().elements
        .find((el) => el.key === elementKey)?.id;
      if (componentId == null) {
        toast.error("Сервер не вернул номер таблицы — рецепт не создан");
        closeModal();
        return;
      }

      setStage("creating");
      const ok = await createRecipe({
        name,
        type: "recipe",
        // В контракте рецептов идентификатор компонента — строка, а в схеме он число.
        component_id: String(componentId),
        values: rows.map((row, index) => ({
          property_name: row.name,
          value: "0",
          position: index,
          description: row.description,
          tag_id: row.tagId,
        })),
      });

      if (ok) onCreated?.(elementKey, componentId);
      closeModal();
    } finally {
      setStage(null);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Создание рецепта
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Отметьте теги — по ним соберётся таблица с колонками «№», «Описание»,
          «Имя свойства» и «Значение». Значения заполнятся нулями, проставить свои
          можно прямо в таблице.
        </Dialog.Description>
      </div>

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
                checkable
                selectable={false}
                showLine={false}
                showIcon={false}
                switcherIcon={SwitcherIcon}
                checkedKeys={checkedKeys}
                onCheck={(keys) => handleCheck((Array.isArray(keys) ? keys : keys.checked) as Key[] as string[])}
                className="custom-tree"
              />
            )}
          </div>

          {selectedTags.length > 0 && (
            <p
              className="shrink-0 text-xs text-gray-500 dark:text-gray-500 truncate"
              title={selectedTags.join("\n")}
            >
              Последний выбранный: {shortTagPath(selectedTags[selectedTags.length - 1])}
            </p>
          )}
        </div>
      )}

      <div className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 mt-4 text-xs text-gray-600 dark:text-gray-400">
        Рецепт заводится за таблицей, поэтому при создании сцена будет сохранена.
      </div>

      <ModalFooter className="shrink-0 mt-4 pt-4 items-center border-t border-gray-200 dark:border-gray-800/80">
        <span className="mr-auto text-sm text-gray-600 dark:text-gray-400">
          {stage ? STAGE_LABEL[stage] : `Выбрано тегов: ${selectedTags.length}`}
        </span>
        <Button onClick={closeModal} disabled={isBusy}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
          {isBusy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          Создать
        </Button>
      </ModalFooter>
    </div>
  );
}

export default function openCreateRecipeTableModal(props: Props = {}) {
  const {openModal} = useModalStore.getState();
  openModal(<CreateRecipeTableModalContent {...props} />);
}
