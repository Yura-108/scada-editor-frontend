import {LeafElement} from "@/types/editorElement.type";

export const getLineBoundingBox = (element: LeafElement)=> {
  const {x1 = 0, y1 = 0, x2 = 0, y2 = 0, strokeWidth = 2} = element;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  const padding = strokeWidth / 2;

  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + strokeWidth,
    height: (maxY - minY) + strokeWidth,
  };
};