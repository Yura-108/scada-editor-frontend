import {LeafElement} from "@/types/editorElement.type";

export default function getTransform(element: LeafElement) {
  const scaleX = element.scaleX ?? 1;
  const scaleY = element.scaleY ?? 1;

  const flipX = element.flipX ? -1 : 1;
  const flipY = element.flipY ? -1 : 1;

  // Центр 50 50 сохраняем для масштабирования (flip) старых элементов,
  // Но `rotate` теперь обрабатывается на уровне родительского контейнера в Canvas
  return `
    translate(50 50)
    scale(${scaleX * flipX} ${scaleY * flipY})
    translate(-50 -50)
  `;
}