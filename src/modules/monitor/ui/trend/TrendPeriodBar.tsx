import React from "react";
import {ChevronLeft, ChevronRight, Radio} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {SegmentedControl} from "@/shared/ui/SegmentedControl";
import {Spinner} from "@/shared/ui/Spinner";
import {Input} from "@/shared/ui/field/Input";
import {TREND_WINDOW_PRESETS} from "@/core/scene";
import {ARCHIVE_DEPTH_MS} from "../../model/archive/archive";
import {toLocalInput} from "../../lib/trendTime";

/** Управление периодом: длина окна, сдвиг на пол-окна, конец периода, «Сейчас», состояние загрузки. */
export function TrendPeriodBar({windowSec, setWindowSec, shift, follow, to, clockNow, setEndTs, loading, aggregated, error}: {
  windowSec: number;
  setWindowSec: (seconds: number) => void;
  shift: (dir: -1 | 1) => void;
  follow: boolean;
  to: number;
  clockNow: () => number;
  setEndTs: (ts: number | null) => void;
  loading: boolean;
  aggregated: boolean;
  error: string | null;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2">
      <SegmentedControl
        aria-label="Длина окна"
        value={String(windowSec)}
        onValueChange={v => setWindowSec(Number(v))}
        items={TREND_WINDOW_PRESETS.map(p => ({value: String(p.seconds), label: p.label}))}
      />

      <IconButton icon={ChevronLeft} label="Назад на пол-окна" onClick={() => shift(-1)} />
      <IconButton icon={ChevronRight} label="Вперёд на пол-окна" onClick={() => shift(1)} disabled={follow} />

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Конец периода
        <Input
          size="sm"
          className="w-auto"
          type="datetime-local"
          value={toLocalInput(to)}
          max={toLocalInput(clockNow())}
          onChange={e => {
            const ts = new Date(e.target.value).getTime();
            if (Number.isNaN(ts)) return;
            setEndTs(ts >= clockNow() ? null : Math.max(ts, Date.now() - ARCHIVE_DEPTH_MS + windowSec * 1000));
          }}
        />
      </label>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEndTs(null)}
        aria-pressed={follow}
        className="aria-pressed:bg-success/15 aria-pressed:text-success"
      >
        <Radio size={12} />
        Сейчас
      </Button>

      {loading && <Spinner className="text-muted-foreground" />}
      {aggregated && !loading && (
        <span className="text-xs text-warning" title="Архив вернул минимумы и максимумы по интервалам — пики сохранены">
          Данные прорежены — сузьте окно, чтобы увидеть каждое изменение
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
