"use client";

import React, { useEffect, useRef } from "react";
import { Transformer } from "react-konva";
import Konva from "konva";
import { DiagramElement, LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { snap } from "@/lib/utils";
import { MIN_SIZE } from "../types";

interface Props {
  /** Одиночный выделенный бокс-элемент (не group/text/circle/line/polygon). */
  element: DiagramElement;
  stageRef: React.RefObject<Konva.Stage | null>;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  /** Зум камеры — якоря держим экранно-постоянного размера (делим на zoom). */
  zoom: number;
}

/**
 * Konva Transformer для одиночного выделения бокс-элементов: 8 ручек ресайза + поворот.
 * Во время трансформации Konva масштабирует узел императивно (без ре-рендеров);
 * на transformend масштаб пересчитывается в реальные w/h (scale сбрасывается в 1),
 * поворот коммитится в `rotate` — фигура ОБЯЗАНА рендерить rotation={rendered.rotate || 0}.
 */
export function SelectionTransformer({ element, stageRef, updateElementVisual, zoom }: Props) {
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;
    const node = stage.findOne(`#${element.key}`);
    if (node) {
      tr.nodes([node]);
      tr.forceUpdate(); // подхватываем внешние изменения размеров (числовые поля панели)
      tr.getLayer()?.batchDraw();
    }
    return () => { tr.nodes([]); };
  }, [element, stageRef]);

  const handleTransformEnd = () => {
    const node = stageRef.current?.findOne(`#${element.key}`);
    if (!node) return;

    const rendered = getRenderedElement(element) as LeafElement;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    // Реальные размеры живут в w/h — scale сбрасываем (он не сериализуется).
    node.scale({ x: 1, y: 1 });

    const rotation = Math.round(((node.rotation() % 360) + 360) % 360);
    const isRotated = rotation !== 0;

    updateElementVisual(element.key, {
      // Снап к сетке только без поворота: у повёрнутого узла x/y включает компенсацию
      // поворота вокруг origin, и снап смещал бы элемент визуально.
      x: isRotated ? Math.round(node.x()) : snap(node.x()),
      y: isRotated ? Math.round(node.y()) : snap(node.y()),
      w: Math.max(MIN_SIZE, isRotated
        ? Math.round((rendered.w || MIN_SIZE) * scaleX)
        : snap((rendered.w || MIN_SIZE) * scaleX)),
      h: Math.max(MIN_SIZE, isRotated
        ? Math.round((rendered.h || MIN_SIZE) * scaleY)
        : snap((rendered.h || MIN_SIZE) * scaleY)),
      rotate: rotation,
    });
  };

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotationSnapTolerance={5}
      keepRatio={false}
      // Маленькие круглые якоря с отступом от элемента — не перекрывают сам виджет.
      anchorSize={6 / zoom}
      anchorCornerRadius={3 / zoom}
      anchorStrokeWidth={1 / zoom}
      borderStrokeWidth={1 / zoom}
      padding={6 / zoom}
      rotateAnchorOffset={18 / zoom}
      anchorStroke="#3b82f6"
      anchorFill="#ffffff"
      borderStroke="#3b82f6"
      borderDash={[4, 3]}
      ignoreStroke
      boundBoxFunc={(oldBox, newBox) =>
        Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? oldBox : newBox
      }
      onTransformEnd={handleTransformEnd}
    />
  );
}
