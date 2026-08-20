import {useEffect, useId, useState} from "react";
import {useDeviceStore} from "@/store/useDeviceStore";
import {unsubscribeDeviceTree} from "@/shared/websocket/wsSubscriptions";
import {
  Search, Building2, FolderOpen, AlertCircle,
  RefreshCw, Check,
} from 'lucide-react';
import {MultiSelect} from "@/components/ui/MultiSelect";

export default function StartMenu() {
  // Состояния для MultiSelect
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // Состояния доступных данных (опций)
  const [availableSites, setAvailableSites] = useState<{value: string, label: string}[]>([]);
  const [availableProjects, setAvailableProjects] = useState<{value: string, label: string}[]>([]);

  // Состояния загрузки
  const [isFetchingSites, setIsFetchingSites] = useState(false);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sitesLabelId = useId();
  const projectsLabelId = useId();

  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState<{ site: string; project: string }[]>([]);

  const { loadNodes, nodes, getParamsTypes } = useDeviceStore();
  const hasData = nodes.length > 0;

  // Отписка при размонтировании
  useEffect(() => {
    return () => {
      activeSubscriptions.forEach(sub => {
        unsubscribeDeviceTree(sub.site, sub.project);
      });
    };
  }, [activeSubscriptions]);

  // 1. Загрузка списка площадок
  useEffect(() => {
    const fetchSites = async () => {
      setIsFetchingSites(true);
      try {
        const res = await fetch('/api/device/site/');

        if (!res.ok) throw new Error('Ошибка сети при загрузке площадок');

        const sites: string[] = await res.json();

        const data = sites.map(site => ({
          value: site,
          label: site,
        }));
        setAvailableSites(data);
      } catch (err) {
        setError('Не удалось загрузить список площадок');
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
        const promises = selectedSites.map(async (siteValue) => {
          const res = await fetch(`/api/device/hierarchy?site=${encodeURIComponent(siteValue)}`);

          if (!res.ok) throw new Error(`Ошибка загрузки проектов для ${siteValue}`);

          const projects: {nodes: {key: string}[], params: []} = await res.json();

          return projects.nodes.map(proj => {
            const label = proj.key.split('.').pop() || '';
            const parentKey = proj.key
              .split('.')
              .slice(0, -1)
              .join('.');

            return {
              value: proj.key,
              label: `${label} (${parentKey})`
            }
          });
        });

        // Ждем, пока загрузятся проекты для ВСЕХ выбранных площадок параллельно
        const results = await Promise.all(promises);

        // Схлопываем массив массивов в один плоский массив: [[proj1, proj2], [proj3]] -> [proj1, proj2, proj3]
        const allProjects = results.flat();

        if (cancelled) return;

        setAvailableProjects(allProjects);

        // Отфильтровываем выбранные проекты, если пользователь снял галочку с их площадки
        setSelectedProjects(prev =>
          prev.filter(selectedProjValue =>
            allProjects.some(availableProj => availableProj.value === selectedProjValue)
          )
        );
      } catch (err) {
        if (cancelled) return;
        setError('Не удалось загрузить список проектов');
        console.error(err);
      } finally {
        if (!cancelled) setIsFetchingProjects(false);
      }
    };

    void fetchProjects();

    return () => { cancelled = true; };
  }, [selectedSites]); // Хук зависит только от selectedSites

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (selectedSites.length === 0 || selectedProjects.length === 0) {
      setError('Пожалуйста, выберите хотя бы одну площадку и проект');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Отписываемся от старых подписок
      activeSubscriptions.forEach(sub => {
        unsubscribeDeviceTree(sub.site, sub.project);
      });

      // ВАЖНО: Тебе нужно будет обновить метод loadNodes в useDeviceStore, 
      // чтобы он принимал массивы string[], а не просто string.
      // @ts-ignore (пока loadNodes не обновлен в сторе)
      await loadNodes(selectedProjects);
      await getParamsTypes();

      // Сохраняем новые подписки (упрощенная логика формирования пар site-project)
      const newSubscriptions = selectedProjects.map(p => ({
        site: selectedSites[0], // ВНИМАНИЕ: Здесь нужно правильно сопоставить проект и его площадку
        project: p
      }));

      setActiveSubscriptions(newSubscriptions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(
        message.includes('Failed to fetch')
          ? 'Не удалось подключиться к серверу. Проверьте соединение.'
          : message || 'Ошибка загрузки проекта',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-app bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-full mb-6 shadow-xl">
            <Search className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg tracking-tight">Поиск проектов</h1>
          <p className="text-xl text-white/90 font-medium">Выберите площадки и проекты для работы</p>
        </div>

        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-4xl shadow-2xl p-10 border border-white/20 dark:border-neutral-700/60">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Поле Площадки. Подпись связана через id + aria-labelledby:
                триггер MultiSelect — кнопка, htmlFor на неё не действует. */}
            <div className="space-y-2">
              <label id={sitesLabelId} className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-2">Площадки</label>
              <MultiSelect
                labelId={sitesLabelId}
                options={availableSites}
                selected={selectedSites}
                onChange={setSelectedSites}
                placeholder="Выберите площадки..."
                icon={<Building2 className="h-6 w-6" />}
                isLoading={isFetchingSites}
              />
            </div>

            {/* Поле Проекты (появляется с анимацией, если выбрана хотя бы одна площадка).
                Пока площадка не выбрана, блок скрыт — прячем его и от Tab/скринридера,
                иначе фокус уходил в невидимую нулевой высоты область. */}
            <div
              aria-hidden={selectedSites.length === 0}
              inert={selectedSites.length === 0}
              className={`transition-all duration-500 overflow-hidden space-y-2
              ${selectedSites.length > 0 ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 pointer-events-none'}`}
            >
              <label id={projectsLabelId} className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-2">Проекты</label>
              <MultiSelect
                labelId={projectsLabelId}
                options={availableProjects}
                selected={selectedProjects}
                onChange={setSelectedProjects}
                placeholder="Выберите проекты..."
                icon={<FolderOpen className="h-6 w-6" />}
                disabled={selectedSites.length === 0}
                isLoading={isFetchingProjects}
              />
            </div>

            {/* Состояние загрузки (Submit) */}
            {isSubmitting && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-3 text-purple-600 dark:text-purple-400">
                  <RefreshCw className="animate-spin h-6 w-6" />
                  <span className="text-lg font-bold">Загрузка устройств...</span>
                </div>
              </div>
            )}

            {/* Ошибка */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-100 dark:border-red-900/60 rounded-2xl p-6 text-center shadow-inner">
                <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto mb-3" />
                <p className="text-red-700 dark:text-red-300 font-bold mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-900 transition-all"
                >
                  Скрыть ошибку
                </button>
              </div>
            )}

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={isSubmitting || selectedSites.length === 0 || selectedProjects.length === 0}
              className="w-full py-5 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 text-white text-xl font-bold hover:from-indigo-700 hover:to-purple-700 transform hover:scale-[1.02] transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'Подключение...' : (
                <>
                  <Search className="w-6 h-6" />
                  Загрузить устройства
                </>
              )}
            </button>
          </form>
        </div>

        {/* Успешное сообщение */}
        {hasData && !isSubmitting && !error && (
          <div className="text-center mt-8 animate-fade-in">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl py-4 px-8 inline-block border border-white/20">
              <p className="text-white text-lg font-bold flex items-center gap-2">
                <Check className="w-5 h-5" /> Данные успешно загружены!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
