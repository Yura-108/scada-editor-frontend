"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {ChevronLeft, ChevronRight, Loader2, Radio} from "lucide-react";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {useTrendStore} from "@/store/useTrendStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {shortTagPath} from "@/lib/editor/tagPath";
import {TREND_WINDOW_PRESETS, trendPens, trendTiming} from "@/lib/editor/trendSettings";
import {buildTrendGeometry, formatTrendTime, formatTrendValue} from "@/lib/editor/trendGeometry";
import {ARCHIVE_DEPTH_MS, fetchArchiveValues, type TrendPoint} from "@/lib/runtime/archive";

interface Props {
  elementKey: string;
}

const MARGIN = {l: 56, r: 16, t: 12, b: 28};

/** Значение пера в момент `ts`: последняя точка не позже него (архив хранит изменения). */
function valueAt(points: readonly TrendPoint[], ts: number): number | null | undefined {
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ts <= ts) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? points[ans].value : undefined;
}

/** `datetime-local` работает в местном времени без пояса. */
const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("ru-RU")} ${formatTrendTime(ts, true)}`;
};

/**
 * Окно тренда в мониторе (контракт 2026-09-28-tag-archive-contract.md, раздел 2).
 *
 * Оператор меняет окно, масштаб перьев и отматывает назад **только у себя**: всё здесь —
 * локальный state, в схему ничего не пишется, и закрытое окно в следующий раз откроется с
 * настройкой из редактора.
 *
 * Данные — свой запрос архива за `[конец − окно, конец]`. В режиме «Сейчас» к нему
 * дописываются живые точки из useTrendStore (их туда кладёт движок монитора), поэтому
 * отдельного канала для живых значений нет.
 */
function TrendModalContent({elementKey}: Props) {
  const closeModal = useModalStore(s => s.closeModal);
  const element = useEditorStore(s => s.elements.find(e => e.key === elementKey));

  const pens = useMemo(() => (element ? trendPens(element) : []), [element]);
  const timing = trendTiming(element?.trend);

  const [windowSec, setWindowSec] = useState(timing.window);
  // null — следуем за текущим временем; число — конец просматриваемого периода.
  const [endTs, setEndTs] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [scale, setScale] = useState<Record<string, {min?: number; max?: number}>>({});

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
    if (!tags.length) return;
    const controller = new AbortController();
    const to = endTs ?? clockNow();
    const from = to - windowSec * 1000;
    setLoading(true);
    setError(null);
    fetchArchiveValues(tags, from, to, {maxPoints: Math.min(5000, Math.max(500, size.w * 2)), signal: controller.signal})
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
  }, [tagsKey, windowSec, endTs, follow ? generation : 0]);

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

  const visiblePens = useMemo(() => pens.filter(p => !hidden.has(p.name)), [pens, hidden]);
  const plot = {x: MARGIN.l, y: MARGIN.t, w: Math.max(1, size.w - MARGIN.l - MARGIN.r), h: Math.max(1, size.h - MARGIN.t - MARGIN.b)};
  const geometry = useMemo(
    () => buildTrendGeometry({
      pens: visiblePens, seriesByTag, from, to, stepSec: timing.step, plot, scaleOverride: scale,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePens, seriesByTag, from, to, timing.step, plot.w, plot.h, scale],
  );

  // Курсор: время и значения всех перьев под ним.
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoverTs = hoverX === null ? null : from + ((hoverX - plot.x) / plot.w) * (to - from);

  const shift = (dir: -1 | 1) => {
    const base = endTs ?? clockNow();
    const next = base + dir * (windowSec * 1000) / 2;
    const oldest = Date.now() - ARCHIVE_DEPTH_MS + windowSec * 1000;
    if (next >= clockNow()) setEndTs(null);
    else setEndTs(Math.max(oldest, next));
  };

  if (!element) {
    return (
      <div className="space-y-4">
        <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">Тренд</Dialog.Title>
        <Dialog.Description className="text-sm text-gray-500">Элемент больше не на схеме.</Dialog.Description>
        <ModalFooter><Button onClick={closeModal}>Закрыть</Button></ModalFooter>
      </div>
    );
  }

  const title = (element as {title?: string}).title || element.label || "Тренд";

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="shrink-0">
        <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">{title}</Dialog.Title>
        <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
          {formatDateTime(from)} — {follow && clockTs === null ? "сейчас" : formatDateTime(to)}. Настройки этого окна не сохраняются.
        </Dialog.Description>
      </div>

      {/* Управление периодом */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          {TREND_WINDOW_PRESETS.map(p => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => setWindowSec(p.seconds)}
              className={cn(
                "px-2.5 py-1 text-xs",
                windowSec === p.seconds
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => shift(-1)} title="Назад на пол-окна"
          className="rounded-lg p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => shift(1)} disabled={follow} title="Вперёд на пол-окна"
          className="rounded-lg p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40">
          <ChevronRight size={16} />
        </button>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          Конец периода
          <input
            type="datetime-local"
            value={toLocalInput(to)}
            max={toLocalInput(clockNow())}
            onChange={e => {
              const ts = new Date(e.target.value).getTime();
              if (Number.isNaN(ts)) return;
              setEndTs(ts >= clockNow() ? null : Math.max(ts, Date.now() - ARCHIVE_DEPTH_MS + windowSec * 1000));
            }}
            className="rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs"
          />
        </label>

        <button
          type="button"
          onClick={() => setEndTs(null)}
          aria-pressed={follow}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            follow
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-gray-500/10 text-gray-600 dark:text-gray-300 hover:bg-gray-500/20",
          )}
        >
          <Radio size={12} />
          Сейчас
        </button>

        {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        {aggregated && !loading && (
          <span className="text-xs text-amber-600 dark:text-amber-400" title="Архив вернул минимумы и максимумы по интервалам — пики сохранены">
            Данные прорежены — сузьте окно, чтобы увидеть каждое изменение
          </span>
        )}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {/* График */}
      <div ref={boxRef} className="relative flex-1 min-h-[240px] rounded-lg bg-slate-900">
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0 select-none"
          onMouseMove={e => {
            const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
            setHoverX(x >= plot.x && x <= plot.x + plot.w ? x : null);
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          {geometry.yTicks.map((t, i) => (
            <g key={`y-${i}`}>
              <line x1={plot.x} x2={plot.x + plot.w} y1={t.y} y2={t.y} stroke="#1e3a5f" />
              <text x={plot.x - 6} y={t.y + 3} textAnchor="end" fontSize={11}
                fill={visiblePens.length > 1 && geometry.yScaleColor ? geometry.yScaleColor : "#94a3b8"}>
                {t.label}
              </text>
            </g>
          ))}
          {geometry.xTicks.map((t, i) => (
            <g key={`x-${i}`}>
              <line x1={t.x} x2={t.x} y1={plot.y} y2={plot.y + plot.h} stroke="#1e3a5f" />
              <text x={t.x} y={plot.y + plot.h + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">{t.label}</text>
            </g>
          ))}
          {geometry.pens.map(g => g.segments.map((pts, i) => (
            <polyline
              key={`${g.name}-${i}`}
              points={pts.join(" ")}
              fill="none"
              stroke={g.color}
              strokeWidth={g.width}
              strokeLinejoin="miter"
            />
          )))}
          <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="none" stroke="#475569" />
          {hoverX !== null && (
            <line x1={hoverX} x2={hoverX} y1={plot.y} y2={plot.y + plot.h} stroke="#e2e8f0" strokeDasharray="3 3" />
          )}
        </svg>

        {hoverX !== null && hoverTs !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md bg-neutral-900/90 px-2 py-1.5 text-xs text-gray-100 shadow"
            style={hoverX > size.w / 2 ? {right: size.w - hoverX + 8} : {left: hoverX + 8}}
          >
            <div className="mb-1 text-gray-400">{formatDateTime(hoverTs)}</div>
            {visiblePens.map(pen => {
              const v = valueAt(seriesByTag[pen.tag] ?? [], hoverTs);
              return (
                <div key={pen.name} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{background: pen.color}} />
                  {pen.label}: {v === undefined ? "—" : v === null ? "нет связи" : formatTrendValue(v)}
                </div>
              );
            })}
          </div>
        )}

        {!pens.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            У тренда нет перьев
          </div>
        )}
      </div>

      {/* Перья: видимость и масштаб — только в этом окне */}
      <div className="shrink-0 grid gap-1.5">
        {pens.map((pen, i) => {
          const g = geometry.pens.find(x => x.name === pen.name);
          const override = scale[pen.name] ?? {};
          const setBound = (key: "min" | "max", raw: string) => {
            const n = raw.trim() === "" ? undefined : Number(raw);
            if (n !== undefined && !Number.isFinite(n)) return;
            setScale(prev => ({...prev, [pen.name]: {...prev[pen.name], [key]: n}}));
          };
          return (
            <div key={pen.name} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex min-w-48 items-center gap-2">
                <input
                  type="checkbox"
                  checked={!hidden.has(pen.name)}
                  onChange={() => setHidden(prev => {
                    const next = new Set(prev);
                    if (next.has(pen.name)) next.delete(pen.name); else next.add(pen.name);
                    return next;
                  })}
                />
                <span className="inline-block h-3 w-3 rounded-sm" style={{background: pen.color}} />
                <span className="text-gray-800 dark:text-gray-200">{pen.label}</span>
                <span className="text-xs text-gray-500" title={pen.tag}>{shortTagPath(pen.tag)}</span>
              </label>
              <span className="w-24 text-right font-mono text-xs text-gray-600 dark:text-gray-300">
                {g?.last === null || g?.last === undefined ? "—" : formatTrendValue(g.last)}
              </span>
              {(["min", "max"] as const).map(key => (
                <label key={key} className="flex items-center gap-1 text-xs text-gray-500">
                  {key === "min" ? "мин" : "макс"}
                  <input
                    key={`${i}-${key}-${override[key] === undefined ? "auto" : "set"}`}
                    type="number"
                    defaultValue={override[key] ?? ""}
                    placeholder={pen[key] !== undefined ? String(pen[key]) : (g ? formatTrendValue(g.scale[key]) : "авто")}
                    onBlur={e => setBound(key, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setBound(key, e.currentTarget.value); }}
                    className="w-20 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-1.5 py-0.5"
                  />
                </label>
              ))}
              {(override.min !== undefined || override.max !== undefined) && (
                <button
                  type="button"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => setScale(prev => {
                    const next = {...prev};
                    delete next[pen.name];
                    return next;
                  })}
                >
                  сбросить
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ModalFooter className="shrink-0">
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

export function openTrendModal(props: Props) {
  useModalStore.getState().openModal(<TrendModalContent {...props} />, {variant: "fullscreen"});
}
