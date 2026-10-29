"use client";

import React, {useMemo, useState} from "react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {buildTrendGeometry, trendScale} from "@/core/scene";
import {Button} from "@/shared/ui/Button";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {formatDateTime} from "../lib/trendTime";
import {useTrendData} from "./trend/useTrendData";
import {TrendPeriodBar} from "./trend/TrendPeriodBar";
import {TrendChart} from "./trend/TrendChart";
import {TrendLegend, type TrendScale} from "./trend/TrendLegend";

interface Props {
  elementKey: string;
}

const MARGIN = {l: 56, r: 16, t: 12, b: 28};

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
  const closeModal = useCloseModal();
  const {
    element, pens, timing, windowSec, setWindowSec, setEndTs, follow, clockTs, clockNow,
    from, to, seriesByTag, aggregated, loading, error, boxRef, size, shift,
  } = useTrendData(elementKey);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  // Общая шкала Y, заданная оператором поверх настройки тренда — только в этом окне.
  const [scale, setScale] = useState<TrendScale>({});

  const settingsScale = trendScale(element?.trend);
  const visiblePens = useMemo(() => pens.filter(p => !hidden.has(p.name)), [pens, hidden]);
  const plot = {x: MARGIN.l, y: MARGIN.t, w: Math.max(1, size.w - MARGIN.l - MARGIN.r), h: Math.max(1, size.h - MARGIN.t - MARGIN.b)};
  const geometry = useMemo(
    () => buildTrendGeometry({
      pens: visiblePens, seriesByTag, from, to, stepSec: timing.step, plot,
      // Граница оператора важнее настройки тренда; нет ни той, ни другой — авто по перьям.
      scale: {min: scale.min ?? settingsScale.min, max: scale.max ?? settingsScale.max},
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePens, seriesByTag, from, to, timing.step, plot.w, plot.h, scale, settingsScale.min, settingsScale.max],
  );

  if (!element) {
    return (
      <>
        <DialogHeader title="Тренд" description="Элемент больше не на схеме." />
        <DialogBody>{null}</DialogBody>
        <DialogFooter><Button onClick={closeModal}>Закрыть</Button></DialogFooter>
      </>
    );
  }

  const title = (element as {title?: string}).title || element.label || "Тренд";

  return (
    <>
      <DialogHeader
        title={title}
        description={<>
          {formatDateTime(from)} — {follow && clockTs === null ? "сейчас" : formatDateTime(to)}. Настройки этого окна не сохраняются.
        </>}
      />

      <DialogBody className="flex flex-col gap-3">
        <TrendPeriodBar
          windowSec={windowSec}
          setWindowSec={setWindowSec}
          shift={shift}
          follow={follow}
          to={to}
          clockNow={clockNow}
          setEndTs={setEndTs}
          loading={loading}
          aggregated={aggregated}
          error={error}
        />

        <TrendChart
          boxRef={boxRef}
          size={size}
          plot={plot}
          geometry={geometry}
          from={from}
          to={to}
          visiblePens={visiblePens}
          seriesByTag={seriesByTag}
          hasPens={pens.length > 0}
        />

        <TrendLegend pens={pens} geometry={geometry} hidden={hidden} setHidden={setHidden} scale={scale} setScale={setScale} />
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Закрыть</Button>
      </DialogFooter>
    </>
  );
}

export function openTrendModal(props: Props) {
  useModalStore.getState().openModal(<TrendModalContent {...props} />, {size: "fullscreen"});
}
