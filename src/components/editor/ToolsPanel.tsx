import React, {useRef, useState} from "react";
import {useStore} from "zustand";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore, SCENE_EXPORT_FORMAT} from "@/store/useEditorStore";
import {
  Save, Group, Ungroup, FilePlus, FolderOpen, Briefcase, Upload, Download,
  Undo2, Redo2, Loader2, History, RotateCcw,
  RotateCw, FlipHorizontal, FlipVertical,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
} from "lucide-react";
import {downloadJson, safeFileName} from "@/lib/downloadJson";
import {choiceModal} from "@/components/ui/ConfirmModal";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {openProjectModal} from "@/components/ui/ProjectModal";
import {usePaletteStore} from "@/store/usePaletteStore";
import {toast} from "sonner";
import VersionHistoryPanel from "@/components/editor/versions/VersionHistoryPanel";
import SaveConflictDialog from "@/components/editor/versions/SaveConflictDialog";
import VersionPreviewBanner from "@/components/editor/versions/VersionPreviewBanner";
import StaleVersionBanner from "@/components/editor/versions/StaleVersionBanner";

function TooltipBtn({
  icon,
  label,
  onClick,
  disabled,
  className,
  badge = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Точка-индикатор в углу кнопки (например, «есть несохранённые изменения»). */
  badge?: boolean;
}) {
  return (
    <div className="relative group/tip">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={className ?? `flex items-center justify-center w-9 h-9 rounded-xl
          bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white
          hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          active:translate-y-0.5 disabled:opacity-20 transition-all`}
      >
        {icon}
        {badge && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900"
          />
        )}
      </button>
      {/* group-focus-within — подсказка видна и при переходе клавиатурой. */}
      <span
        role="tooltip"
        className="
        absolute top-full left-1/2 -translate-x-1/2 mt-2 z-dropdown
        px-2 py-1 text-xs font-medium rounded-lg whitespace-nowrap
        bg-gray-900 dark:bg-gray-700 text-white
        opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 pointer-events-none
        transition-opacity duration-150
      ">
        {label}
      </span>
    </div>
  );
}

/**
 * Отступы тулбара от боковых панелей приходят CSS-переменными от WorkSpace
 * (`--ws-left-m` / `--ws-right-m`), а не числовыми пропсами: во время
 * перетаскивания края панели их пишет обработчик указателя, без ре-рендера.
 */
export default function ToolsPanel() {
  // Точечный срез: подписка на весь стор перерисовывала панель на каждый тик
  // пана/зума (то же замечание, что и в WorkSpace/Canvas).
  const {
    selectedIds, exportScene, elements, loadSceneList, createScene, scene, currentProject,
    isSaving, isDirty, lastSavedAt, versionPreview, sceneVersion,
  } = useEditorStore(useShallow(s => ({
    selectedIds: s.selectedIds, exportScene: s.exportScene, elements: s.elements,
    loadSceneList: s.loadSceneList, createScene: s.createScene,
    scene: s.scene, currentProject: s.currentProject,
    isSaving: s.isSaving, isDirty: s.isDirty, lastSavedAt: s.lastSavedAt,
    versionPreview: s.versionPreview, sceneVersion: s.sceneVersion,
  })));

  // Глубина стеков undo/redo — чтобы кнопки гасли, когда отменять нечего.
  const canUndo = useStore(useEditorStore.temporal, s => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, s => s.futureStates.length > 0);

  const {loadPaletteItems} = usePaletteStore();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Иерархия Проект -> Схема -> Элементы: блокируем операции над сценой,
  // если она не принадлежит выбранному проекту (или проект/сцена не выбраны).
  const sceneBelongsToProject = !!currentProject
    && !!scene
    && (scene.project_id == null || scene.project_id === currentProject.id);
  // В режиме просмотра версии на холсте лежит старая версия: любая правка ушла бы
  // в текущую сцену как чужое прошлое. Одна проверка гасит разом импорт, undo/redo,
  // группировку, выравнивание и сохранение — все они уже завязаны на canEdit.
  const canEdit = sceneBelongsToProject && !versionPreview;

  const handleOpenProject = () => {
    openProjectModal();
  };

  const handleLoadSchema = async () => {
    if (!currentProject) {
      toast.info("Сначала выберите проект");
      openProjectModal();
      return;
    }
    await loadSceneList(currentProject.id);
    openChooseSceneModal();
  };

  const handleImport = () => {
    if (!scene) {
      toast.info("Сначала загрузите или создайте схему");
      return;
    }
    if (!sceneBelongsToProject) {
      toast.error("Схема не принадлежит выбранному проекту");
      return;
    }
    importInputRef.current?.click();
  };

  const handleExport = () => {
    if (!scene) {
      toast.info("Сначала загрузите или создайте схему");
      return;
    }

    const file = useEditorStore.getState().buildSceneExport();
    if (!file.elements.length) {
      toast.info("Схема пуста — экспортировать нечего");
      return;
    }

    // Дата в имени: файл кладут «себе на компьютер», и через неделю их там несколько.
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`${safeFileName(scene.name, "scheme")}_${stamp}.json`, file);
    toast.success(`Сохранено элементов: ${file.elements.length}`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sceneBelongsToProject) {
      toast.error("Схема не принадлежит выбранному проекту");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);

        // Свой файл приезжает конвертом (см. buildSceneExport), чужая выгрузка — голым
        // массивом. Флаг `native` важнее удобства: без него нормализатор CONTUR второй
        // раз пересчитал бы координаты схемы, однажды пришедшей из выгрузки.
        const native = !Array.isArray(json)
          && json?.format === SCENE_EXPORT_FORMAT
          && Array.isArray(json.elements);
        const arr: Record<string, unknown>[] = native
          ? json.elements
          : (Array.isArray(json) ? json : [json]);

        // На непустой схеме спрашиваем: без этого повторный импорт того же листа молча
        // удваивал схему, а замена была недоступна вовсе.
        let mode: "append" | "replace" = "replace";
        if (useEditorStore.getState().elements.length) {
          const answer = await choiceModal({
            title: "На схеме уже есть элементы",
            description: `В файле ${arr.length} элементов. Что с ними сделать?`,
            options: [
              {
                id: "replace",
                label: "Заменить содержимое схемы",
                description: "Текущие элементы будут убраны. Отменяется через Ctrl+Z, на сервере — до ближайшего сохранения.",
                danger: true,
              },
              {
                id: "append",
                label: "Добавить к существующим",
                description: "Импортированное ляжет поверх текущего. Повторный импорт того же файла задвоит элементы.",
              },
            ],
          });
          if (!answer) return;
          mode = answer as "append" | "replace";
        }

        const stats = useEditorStore.getState().importElementsFromJson(arr, {mode, native});

        if (!stats) {
          toast.success(`Импортировано элементов: ${arr.length}`);
          return;
        }

        // Разбивка по типам — она же приёмка: контрольные числа листа сверяются глазами,
        // без консоли (см. docs/contur/CONTUR_IMPORT_PLAN.md, §5). Виды перечислены все, что бывают
        // в выгрузке: пропущенный вид — это молча не сошедшееся число при приёмке.
        const breakdown = [
          `техобъектов ${stats.groups}`,
          stats.frameLines
            ? `линий чертежа ${stats.lines} (рамка листа ${stats.frameLines})`
            : `линий чертежа ${stats.lines}`,
          `устройств ${stats.circles}`,
          `подписей ${stats.labels}`,
          `имён контуров ${stats.contourNames}`,
          `рамок ${stats.contourFrames + stats.frames}`,
        ];
        if (stats.drawingTexts) breakdown.push(`надписей чертежа ${stats.drawingTexts}`);
        if (stats.meta) breakdown.push(`данные листа ${stats.meta}`);

        toast.success(`Импортировано элементов: ${stats.total}`, {
          description: breakdown.join(" · "),
          duration: 12_000,
        });

        if (stats.repairedLinks) {
          toast.warning(`Достроено связей групп: ${stats.repairedLinks}`, {
            description: "В файле были односторонние ссылки родитель ↔ ребёнок. Стоит сказать об этом CONTUR.",
            duration: 12_000,
          });
        }
      } catch {
        toast.error("Ошибка чтения файла: неверный JSON");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleCreateSchema = async () => {
    if (!currentProject) {
      toast.info("Сначала выберите проект");
      openProjectModal();
      return;
    }
    await createScene();
    await loadPaletteItems();
  };

  return (
    <nav
      style={{
        left: "var(--ws-left-m, 0px)",
        right: "var(--ws-right-m, 0px)",
      }}
      className="fixed top-26 z-toolbar grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Проект и сцена: отдельная колонка слева, не влияет на центрирование тулбара */}
      <div className="min-w-0 flex justify-start">
        {(currentProject || scene) && (
          <div className="min-w-0 flex items-center gap-3 text-xs font-medium text-neutral-400 pointer-events-auto">
            {currentProject && (
              <span className="truncate">
                Проект: <span className="text-gray-900 dark:text-gray-100 font-semibold">{currentProject.name}</span>
              </span>
            )}
            {scene && (
              <span className="truncate">
                Схема: <span className="text-gray-900 dark:text-gray-100 font-semibold">{scene.name}</span>
              </span>
            )}
            {/* Статус сохранения: автосейв тихий и раз в 10 минут, поэтому без
                этой подписи пользователь не знал, в безопасности ли его работа.
                В режиме просмотра версии статус не показываем — там говорит плашка,
                а «сохранено в …» рядом со старой версией только запутает. */}
            {scene && !versionPreview && (
              <span className="shrink-0 whitespace-nowrap">
                {isSaving
                  ? <span className="text-neutral-500 dark:text-neutral-400">сохранение…</span>
                  : isDirty
                    ? <span className="text-amber-600 dark:text-amber-400">● есть несохранённые изменения</span>
                    : lastSavedAt
                      ? <span className="text-neutral-500 dark:text-neutral-400">
                          сохранено в {new Date(lastSavedAt).toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"})}
                        </span>
                      : null}
                {sceneVersion != null && (
                  <span className="ml-2 text-neutral-400 dark:text-neutral-500">версия {sceneVersion}</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto justify-self-center">

        <TooltipBtn icon={<Briefcase size={16} />} label="Проект" onClick={handleOpenProject} />
        <TooltipBtn icon={<FilePlus size={16} />} label="Создать схему" onClick={handleCreateSchema} />
        <TooltipBtn icon={<FolderOpen size={16} />} label="Загрузить схему" onClick={handleLoadSchema} />
        <TooltipBtn
          icon={<Upload size={16} />} label="Импорт" onClick={handleImport}
          disabled={!canEdit}
        />
        <TooltipBtn
          icon={<Download size={16} />} label="Экспорт в файл" onClick={handleExport}
          disabled={!scene || !elements.length}
        />

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />

        {/* Отмена/повтор: раньше существовали только как Ctrl+Z/Ctrl+Y, без
            подсказки в интерфейсе и без признака, что стек пуст. */}
        <TooltipBtn
          icon={<Undo2 size={16} />}
          label="Отменить (Ctrl+Z)"
          onClick={() => useEditorStore.temporal.getState().undo()}
          disabled={!canEdit || !canUndo}
        />
        <TooltipBtn
          icon={<Redo2 size={16} />}
          label="Повторить (Ctrl+Y)"
          onClick={() => useEditorStore.temporal.getState().redo()}
          disabled={!canEdit || !canRedo}
        />

        {/* Отмена выше — клиентская и по действиям (zundo, в памяти). Здесь другое:
            сохранённые на сервере версии схемы, с автором и временем. Обе кнопки
            доступны и в режиме просмотра версии — из него надо уметь выйти в историю. */}
        <TooltipBtn
          icon={<History size={16} />}
          label={sceneVersion != null ? `История версий (текущая ${sceneVersion})` : "История версий"}
          onClick={() => setHistoryOpen(v => !v)}
          disabled={!scene}
        />
        <TooltipBtn
          icon={<RotateCcw size={16} />}
          label="Вернуться к предыдущему сохранению"
          onClick={() => { void useEditorStore.getState().restorePreviousManualVersion(); }}
          disabled={!scene || !!versionPreview}
        />

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />

        <TooltipBtn
          icon={<Group size={16} />}
          label="Сгруппировать"
          onClick={() => useEditorStore.getState().groupSelected()}
          disabled={!canEdit || selectedIds.length < 2}
        />
        <TooltipBtn
          icon={<Ungroup size={16} />}
          label="Разгруппировать"
          onClick={() => useEditorStore.getState().ungroupSelected()}
          disabled={!canEdit || !selectedIds.some(id => elements.find(e => e.key === id)?.type === "group")}
        />

        {/* Поворот на 90° и отражения. Работают и для одного элемента, и для набора,
            и для группы целиком: геометрия пересчитывается по-настоящему (см.
            lib/editor/transformSelection.ts), поэтому всё остаётся на сетке. */}
        <TooltipBtn
          icon={<RotateCw size={16} />}
          label="Повернуть по часовой (Shift + >)"
          onClick={() => useEditorStore.getState().transformSelected("cw")}
          disabled={!canEdit || !selectedIds.length}
        />
        <TooltipBtn
          icon={<RotateCcw size={16} />}
          label="Повернуть против часовой (Shift + <)"
          onClick={() => useEditorStore.getState().transformSelected("ccw")}
          disabled={!canEdit || !selectedIds.length}
        />
        <TooltipBtn
          icon={<FlipHorizontal size={16} />}
          label="Отразить по горизонтали (Shift + H)"
          onClick={() => useEditorStore.getState().transformSelected("flipH")}
          disabled={!canEdit || !selectedIds.length}
        />
        <TooltipBtn
          icon={<FlipVertical size={16} />}
          label="Отразить по вертикали (Shift + V)"
          onClick={() => useEditorStore.getState().transformSelected("flipV")}
          disabled={!canEdit || !selectedIds.length}
        />

        <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />

        {/* Выравнивание (≥2 выделенных) и распределение (≥3).
            Блок был закомментирован, из-за чего alignSelected/distributeSelected
            в сторе оставались недостижимым кодом. */}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignStartVertical size={16} />} label="По левому краю"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('left')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignCenterVertical size={16} />} label="По центру (гориз.)"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('hcenter')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignEndVertical size={16} />} label="По правому краю"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('right')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignStartHorizontal size={16} />} label="По верхнему краю"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('top')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignCenterHorizontal size={16} />} label="По центру (верт.)"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('vcenter')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignEndHorizontal size={16} />} label="По нижнему краю"*/}
        {/*  onClick={() => useEditorStore.getState().alignSelected('bottom')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 2}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignHorizontalSpaceBetween size={16} />} label="Распределить по горизонтали"*/}
        {/*  onClick={() => useEditorStore.getState().distributeSelected('h')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 3}*/}
        {/*/>*/}
        {/*<TooltipBtn*/}
        {/*  icon={<AlignVerticalSpaceBetween size={16} />} label="Распределить по вертикали"*/}
        {/*  onClick={() => useEditorStore.getState().distributeSelected('v')}*/}
        {/*  disabled={!canEdit || selectedIds.length < 3}*/}
        {/*/>*/}

        {/*<div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />*/}

        {/* Пока сохранение идёт — спиннер и блокировка: раньше промис не
            ожидался и не было никакого признака работы, поэтому нетерпеливые
            клики выстраивали очередь из полных циклов «сохранение + перезагрузка».
            Точка-индикатор показывает несохранённые изменения. */}
        <TooltipBtn
          icon={isSaving
            ? <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
            : <Save size={16} strokeWidth={2.5} />}
          label={isSaving ? "Сохранение…" : isDirty ? "Сохранить (есть изменения)" : "Сохранить"}
          onClick={() => { void exportScene(); }}
          disabled={!canEdit || isSaving}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl
            bg-primary/10 border border-primary/30 text-primary
            hover:bg-primary/20 hover:border-primary/40
            active:translate-y-0.5 transition-all
            disabled:opacity-20 disabled:cursor-not-allowed"
          badge={isDirty && !isSaving}
        />
      </div>

      <div className="min-w-0 flex justify-end">
        {scene && currentProject && !sceneBelongsToProject && (
          <div className="truncate text-xs font-medium text-red-500 dark:text-red-400 pointer-events-auto">
            Сцена не принадлежит проекту «{currentProject.name}». Выберите сцену из списка.
          </div>
        )}
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Плашка просмотра, панель истории и диалог конфликта живут здесь, потому что
          тулбар — единственная часть редактора, которая монтируется ровно один раз на
          вкладке «Редактор». Сама <nav> не ловит указатель (pointer-events-none),
          поэтому потомки включают его себе сами. */}
      <VersionPreviewBanner />
      <StaleVersionBanner />
      <div className="pointer-events-auto">
        <VersionHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      </div>
      <SaveConflictDialog />
    </nav>
  );
}
