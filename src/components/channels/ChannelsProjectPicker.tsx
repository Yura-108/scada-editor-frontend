import {useEffect, useId, useState} from "react";
import {toast} from "sonner";
import {Building2, Download, FolderOpen, RefreshCw} from 'lucide-react';
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {MultiSelect} from "@/shared/ui/MultiSelect";
import {useDeviceDictionaries, useDeviceTreeStore} from "@/core/devices";

const compact = "px-3 py-1.5 text-sm shadow-none whitespace-nowrap";

/** Площадка проекта — первый сегмент его ключа (`площадка.проект`). */
const siteOf = (projectKey: string) => projectKey.split('.')[0];

interface Props {
  /** `toolbar` — в строку панели «Базы каналов»; `stacked` — столбиком внутри пустого дерева. */
  layout?: "toolbar" | "stacked";
}

/**
 * Какие площадки и проекты загрузить в дерево устройств. Одно и то же место выбора и в панели
 * «Базы каналов», и в пустом дереве тегов «Автоматизации» и окна выбора тега: раньше там был
 * текст «выберите площадку и проект ниже», а ниже ничего не было.
 */
export default function ChannelsProjectPicker({layout = "toolbar"}: Props) {
  const { loadNodes, loadedRootPath } = useDeviceTreeStore();
  const { getParamsTypes } = useDeviceDictionaries();

  // Возвращаясь в раздел, видим то, что уже загружено, а не пустые поля.
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() => loadedRootPath ?? []);
  const [selectedSites, setSelectedSites] = useState<string[]>(
    () => [...new Set((loadedRootPath ?? []).map(siteOf))],
  );

  const [availableSites, setAvailableSites] = useState<{value: string, label: string}[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
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
        setSitesLoaded(true);
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
      const { nodesError } = useDeviceTreeStore.getState();
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

  // Площадок нет вовсе: чтение каталога фильтруется по веткам, и без веток бэкенд отдаёт
  // пустой список, а не 403 — иначе пользователь не узнал бы причину.
  if (sitesLoaded && availableSites.length === 0) {
    return (
      <span className={cn("text-sm text-neutral-500", layout === "stacked" && "block text-center")}>
        Нет доступных площадок — ветки каталога выдаёт администратор.
      </span>
    );
  }

  const loadHint = selectedSites.length === 0 ? 'Сначала выберите площадку'
    : selectedProjects.length === 0 ? 'Выберите один или несколько проектов'
    : 'Загрузить устройства выбранных проектов в дерево';
  const stacked = layout === "stacked";

  return (
    <div className={cn(stacked ? "flex flex-col gap-2 w-full max-w-xs" : "contents")}>
      <span id={sitesLabelId} className="sr-only">Площадки</span>
      <MultiSelect
        labelId={sitesLabelId}
        className={stacked ? "w-full" : "w-48"}
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
        className={stacked ? "w-full" : "w-64"}
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
    </div>
  );
}
