"use client";

import React, {useMemo, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {buildTrendGeometry, trendScale} from "@/core/scene";
import {Button, ModalFooter} from "@/shared/ui/Button";
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
  const closeModal = useModalStore(s => s.closeModal);
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

      <ModalFooter className="shrink-0">
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

export function openTrendModal(props: Props) {
  useModalStore.getState().openModal(<TrendModalContent {...props} />, {size: "fullscreen", legacyLayout: true});
}
