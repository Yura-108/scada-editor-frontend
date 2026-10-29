import {useEffect, useMemo, useRef, useState} from "react";
import {useTrendStore} from "@/core/canvas";
import {trendPens, trendTiming, useSceneView} from "@/core/scene";
import {useOpenScene} from "@/core/project";
import {ARCHIVE_DEPTH_MS, fetchArchiveValues, type TrendPoint} from "../../model/archive/archive";

/**
 * Данные окна тренда: период (окно и конец), история из архива за `[конец − окно, конец]`
 * с живым хвостом из useTrendStore в режиме «Сейчас» и размер области графика.
 */
export function useTrendData(elementKey: string) {
  const element = useSceneView(s => s.elements.find(e => e.key === elementKey));
  const projectId = useOpenScene(s => s.currentProject?.id ?? null);

  const pens = useMemo(() => (element ? trendPens(element) : []), [element]);
  const timing = trendTiming(element?.trend);

  const [windowSec, setWindowSec] = useState(timing.window);
  // null — следуем за текущим временем; число — конец просматриваемого периода.
  const [endTs, setEndTs] = useState<number | null>(null);

  const [history, setHistory] = useState<{series: Record<string, TrendPoint[]>; to: number} | null>(null);
  const [aggregated, setAggregated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // В архиве «сейчас» — курсор воспроизведения: «Сейчас» следует за ним, а не за часами.
  const clockTs = useTrendStore(s => s.clockTs);
  const generation = useTrendStore(s => s.generation);
  const clockNow = () => useTrendStore.getState().clockTs ?? Date.now();

  const [realNow, setNow] = useState(() => Date.now());
  const now = clockTs ?? realNow;
  const follow = endTs === null;
  useEffect(() => {
    if (!follow || clockTs !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [follow, clockTs]);

  // Размер графика — по контейнеру: SVG рисуется в пикселях, чтобы подписи не растягивались.
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w: 900, h: 380});
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const {width, height} = entry.contentRect;
      if (width > 0 && height > 0) setSize({w: Math.round(width), h: Math.round(height)});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tags = useMemo(() => pens.map(p => p.tag), [pens]);
  const tagsKey = tags.join("\n");

  // Запрос истории: на смену окна или конца периода. В режиме «Сейчас» — один раз на окно,
  // дальше живые точки; секундный тик часов запрос не повторяет.
  useEffect(() => {
    if (!tags.length || projectId == null) return;
    const controller = new AbortController();
    const to = endTs ?? clockNow();
    const from = to - windowSec * 1000;
    setLoading(true);
    setError(null);
    const maxPoints = Math.min(5000, Math.max(500, size.w * 2));
    fetchArchiveValues(tags, from, to, {projectId, maxPoints, signal: controller.signal})
      .then(result => {
        if (controller.signal.aborted) return;
        const series: Record<string, TrendPoint[]> = {};
        let agg = false;
        for (const [tag, s] of result) {
          series[tag] = s.initial ? [s.initial, ...s.points] : s.points;
          if (s.aggregated) agg = true;
        }
        setHistory({series, to});
        setAggregated(agg);
      })
      .catch(e => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // size.w — только для maxPoints; перезапрашивать на каждый ресайз окна незачем.
    // generation — перемотка архива: живой хвост стора начался заново, история устарела.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsKey, projectId, windowSec, endTs, follow ? generation : 0]);

  const live = useTrendStore(s => s.seriesByTag);

  const to = endTs ?? now;
  const from = to - windowSec * 1000;

  const seriesByTag = useMemo(() => {
    const out: Record<string, TrendPoint[]> = {};
    for (const tag of tags) {
      const hist = history?.series[tag] ?? [];
      if (!follow) { out[tag] = hist; continue; }
      // Живые точки — только то, что пришло после конца запроса истории.
      const since = history?.to ?? -Infinity;
      const tail = (live[tag] ?? []).filter(p => p.ts > since);
      out[tag] = tail.length ? [...hist, ...tail] : hist;
    }
    return out;
  }, [tags, history, live, follow]);

  const shift = (dir: -1 | 1) => {
    const base = endTs ?? clockNow();
    const next = base + dir * (windowSec * 1000) / 2;
    const oldest = Date.now() - ARCHIVE_DEPTH_MS + windowSec * 1000;
    if (next >= clockNow()) setEndTs(null);
    else setEndTs(Math.max(oldest, next));
  };

  return {
    element, pens, timing, windowSec, setWindowSec, endTs, setEndTs, follow, clockTs, clockNow,
    from, to, seriesByTag, aggregated, loading, error, boxRef, size, shift,
  };
}
