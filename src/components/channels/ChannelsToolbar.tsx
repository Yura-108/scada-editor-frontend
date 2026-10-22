import {useEffect, useId, useState} from "react";
import {toast} from "sonner";
import {Building2, Download, FileUp, FolderOpen, RefreshCw} from 'lucide-react';
import {useDeviceStore} from "@/store/useDeviceStore";
import {Button} from "@/components/ui/Button";
import {MultiSelect} from "@/components/ui/MultiSelect";
import {openImportCdbxModal} from "@/components/channels/OpenImportCdbxModal";

const compact = "px-3 py-1.5 text-sm shadow-none whitespace-nowrap";

/** Площадка проекта — первый сегмент его ключа (`площадка.проект`). */
const siteOf = (projectKey: string) => projectKey.split('.')[0];

/**
 * Верхняя панель «Базы каналов»: какие площадки и проекты загрузить в дерево, плюс импорт.
 *
 * Раньше это был отдельный полноэкранный блок с ярким градиентом под рабочей областью: до него
 * приходилось листать, и не все понимали, что он вообще есть. Теперь выбор всегда на виду,
 * в одной строке с названием раздела, как на остальных страницах.
 */
export default function ChannelsToolbar() {
  const {loadNodes, getParamsTypes, loadedRootPath} = useDeviceStore();

  // Возвращаясь в раздел, видим то, что уже загружено, а не пустые поля.
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() => loadedRootPath ?? []);
  const [selectedSites, setSelectedSites] = useState<string[]>(
    () => [...new Set((loadedRootPath ?? []).map(siteOf))],
  );

  const [availableSites, setAvailableSites] = useState<{value: string, label: string}[]>([]);
  const [availableProjects, setAvailableProjects] = useState<{value: string, label: string}[]>([]);

  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sitesLabelId = useId();
  const projectsLabelId = useId();

  // 1. Загрузка списка площадок
  useEffect(() => {
    const fetchSites = async () => {
      setIsFetchingSites(true);
      try {
        const res = await fetch('/api/device/site/');
        if (!res.ok) throw new Error('Ошибка сети при загрузке площадок');
        const sites: string[] = await res.json();
        setAvailableSites(sites.map(site => ({value: site, label: site})));
      } catch (err) {
        toast.error('Не удалось загрузить список площадок');
        console.error(err);
      } finally {
        setIsFetchingSites(false);
      }
    };
    void fetchSites();
  }, []);

  // 2. Загрузка проектов при изменении выбранных площадок
  useEffect(() => {
    if (selectedSites.length === 0) {
      setAvailableProjects([]);
      setSelectedProjects([]);
      return;
    }

    // Защита от «гонки последнего ответа»: при быстром переключении площадок
    // ответ старого запроса мог прийти последним и показать проекты уже снятой
    // площадки. Помечаем эффект устаревшим при следующем запуске/размонтировании.
    let cancelled = false;

    const fetchProjects = async () => {
      setIsFetchingProjects(true);
      try {
        const results = await Promise.all(selectedSites.map(async (siteValue) => {
          const res = await fetch(`/api/device/hierarchy?site=${encodeURIComponent(siteValue)}`);
          if (!res.ok) throw new Error(`Ошибка загрузки проектов для ${siteValue}`);
          const projects: {nodes: {key: string}[], params: []} = await res.json();
          return projects.nodes.map(proj => {
            const parts = proj.key.split('.');
            // Площадка в подписи нужна, только когда выбрано несколько: иначе она одна и та же.
            const label = parts.pop() || '';
            return {value: proj.key, label: selectedSites.length > 1 ? `${label} (${parts.join('.')})` : label};
          });
        }));
        const allProjects = results.flat();
        if (cancelled) return;

        setAvailableProjects(allProjects);
        // Снятая площадка уносит свои проекты из выбора.
        setSelectedProjects(prev => prev.filter(value => allProjects.some(p => p.value === value)));
      } catch (err) {
        if (cancelled) return;
        toast.error('Не удалось загрузить список проектов');
        console.error(err);
      } finally {
        if (!cancelled) setIsFetchingProjects(false);
      }
    };

    void fetchProjects();
    return () => { cancelled = true; };
  }, [selectedSites]);

  const handleLoad = async () => {
    if (isSubmitting || selectedProjects.length === 0) return;
    setIsSubmitting(true);
    try {
      await loadNodes(selectedProjects);
      await getParamsTypes();
      const {nodesError} = useDeviceStore.getState();
      if (!nodesError) toast.success(selectedProjects.length > 1 ? `Загружено проектов: ${selectedProjects.length}` : 'Проект загружен');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast.error(
        message.includes('Failed to fetch')
          ? 'Не удалось подключиться к серверу. Проверьте соединение.'
          : message || 'Ошибка загрузки проекта',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadHint = selectedSites.length === 0 ? 'Сначала выберите площадку'
    : selectedProjects.length === 0 ? 'Выберите один или несколько проектов'
    : 'Загрузить устройства выбранных проектов в дерево';

  return (
    <div className="shrink-0 min-h-12 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
      <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">База каналов</span>

      <span id={sitesLabelId} className="sr-only">Площадки</span>
      <MultiSelect
        labelId={sitesLabelId}
        className="w-48"
        options={availableSites}
        selected={selectedSites}
        onChange={setSelectedSites}
        placeholder="Площадка…"
        icon={<Building2 />}
        isLoading={isFetchingSites}
      />

      <span id={projectsLabelId} className="sr-only">Проекты</span>
      <MultiSelect
        labelId={projectsLabelId}
        className="w-64"
        options={availableProjects}
        selected={selectedProjects}
        onChange={setSelectedProjects}
        placeholder={selectedSites.length ? "Проект…" : "Сначала площадка"}
        icon={<FolderOpen />}
        disabled={selectedSites.length === 0}
        isLoading={isFetchingProjects}
      />

      <Button
        variant="primary"
        className={compact}
        onClick={() => void handleLoad()}
        disabled={isSubmitting || selectedProjects.length === 0}
        title={loadHint}
      >
        {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
        {isSubmitting ? 'Загрузка…' : 'Загрузить'}
      </Button>

      <div className="flex-1" />

      {/* Импорт создаёт НОВЫЙ проект: после отчёта он сам подгружается в дерево и появляется
          в списке проектов слева. */}
      <Button className={compact} onClick={openImportCdbxModal} title="Создать проект из файла базы каналов .cdbx">
        <FileUp size={14} />Импорт .cdbx
      </Button>
    </div>
  );
}
