import React, {type Dispatch, type SetStateAction} from "react";
import {formatTrendValue, shortTagPath, type buildTrendGeometry, type trendPens} from "@/core/scene";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Input} from "@/shared/ui/field/Input";

type Geometry = ReturnType<typeof buildTrendGeometry>;
type Pen = ReturnType<typeof trendPens>[number];
export type TrendScale = {min?: number; max?: number};

/** Общая шкала Y и перья (видимость, последнее значение, коэффициент) — только в этом окне. */
export function TrendLegend({pens, geometry, hidden, setHidden, scale, setScale}: {
  pens: Pen[];
  geometry: Geometry;
  hidden: ReadonlySet<string>;
  setHidden: Dispatch<SetStateAction<ReadonlySet<string>>>;
  scale: TrendScale;
  setScale: Dispatch<SetStateAction<TrendScale>>;
}) {
  const setBound = (key: "min" | "max", raw: string) => {
    const n = raw.trim() === "" ? undefined : Number(raw);
    if (n !== undefined && !Number.isFinite(n)) return;
    setScale(prev => {
      const next = {...prev};
      if (n === undefined) delete next[key]; else next[key] = n;
      return next;
    });
  };

  return (
    <>
      <div className="shrink-0 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="font-medium text-gray-700 dark:text-gray-300">Шкала Y</span>
        {(["min", "max"] as const).map(key => (
          <label key={key} className="flex items-center gap-1">
            {key === "min" ? "мин" : "макс"}
            <Input
              size="sm"
              className="w-24"
              key={`${key}-${scale[key] === undefined ? "auto" : "set"}`}
              type="number"
              defaultValue={scale[key] ?? ""}
              placeholder={formatTrendValue(geometry.scale[key])}
              onBlur={e => setBound(key, e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setBound(key, e.currentTarget.value); }}
            />
          </label>
        ))}
        {(scale.min !== undefined || scale.max !== undefined) && (
          <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setScale({})}>
            как в настройке
          </button>
        )}
      </div>

      <div className="shrink-0 grid gap-1.5">
        {pens.map(pen => {
          const g = geometry.pens.find(x => x.name === pen.name);
          return (
            <div key={pen.name} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex min-w-48 items-center gap-2">
                <Checkbox
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
              {(pen.k !== 1 || pen.b !== 0) && (
                <span className="text-xs text-gray-500" title="Коэффициент и сдвиг пера: на графике значение тега × k + b">
                  {pen.k !== 1 ? `×${pen.k}` : ""}{pen.b !== 0 ? ` ${pen.b > 0 ? "+" : "−"}${Math.abs(pen.b)}` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
