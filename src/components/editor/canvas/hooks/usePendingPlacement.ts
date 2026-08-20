import { RefObject, useCallback, useEffect } from "react";
import Konva from "konva";
import { useEditorStore } from "@/store/useEditorStore";
import { pickImageFile, fitImageSize } from "@/lib/pickImageFile";
import { createUuid } from "@/lib/createUuid";

interface PendingPlacementDeps {
  stageRef: RefObject<Konva.Stage | null>;
  pendingPlacement: ReturnType<typeof useEditorStore.getState>["pendingPlacement"];
}

/**
 * Постановка «вооружённого» элемента палитры по клику на холст + курсор-«прицел»,
 * пока инструмент вооружён.
 */
export function usePendingPlacement({ stageRef, pendingPlacement }: PendingPlacementDeps) {
  // Курсор-«прицел» над холстом, пока инструмент вооружён.
  useEffect(() => {
    const container = stageRef.current?.container();
    if (container) container.style.cursor = pendingPlacement ? "crosshair" : "default";
  }, [pendingPlacement, stageRef]);

  // Постановка «вооружённого» элемента палитры по клику на холст. click в Konva
  // всплывает от фигуры к Stage, поэтому срабатывает и по пустому месту, и по фигуре.
  const handleStagePlacementClick = useCallback(() => {
    const pending = useEditorStore.getState().pendingPlacement;
    if (!pending) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!stage || !pos) return;

    // screen → world (та же формула, что в маркизе useStageInteractions):
    // Stage.x()===camera.x, Stage.scaleX()===camera.zoom.
    const worldX = (pos.x - stage.x()) / stage.scaleX();
    const worldY = (pos.y - stage.y()) / stage.scaleX();

    const { addElementAt, addTemplate, updateElementVisual, setPendingPlacement } = useEditorStore.getState();
    const { type, template } = pending;

    if (type === "custom") {
      if (template) addTemplate(worldX, worldY, template);
    } else if (type === "image") {
      // Плейсхолдер сразу в точке клика, затем проводник заполняет src по этому key.
      const key = createUuid();
      addElementAt(worldX, worldY, "image", { key });
      void (async () => {
        const src = await pickImageFile();
        if (!src) return;
        const { w, h } = await fitImageSize(src, 240);
        updateElementVisual(key, { src, w, h });
      })();
    } else {
      addElementAt(worldX, worldY, type);
    }

    setPendingPlacement(null); // ставим по одному
  }, [stageRef]);

  return { handleStagePlacementClick };
}
