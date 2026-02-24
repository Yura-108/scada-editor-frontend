export default function getTransform(element: BaseElement) {
  const rotate = element.rotate ?? 0;
  const scaleX = element.scaleX ?? 1;
  const scaleY = element.scaleY ?? 1;

  const flipX = element.flipX ? -1 : 1;
  const flipY = element.flipY ? -1 : 1;

  // центр 50 50 (потому что viewBox 0 0 100 100)
  return `
    translate(50 50)
    rotate(${rotate})
    scale(${scaleX * flipX} ${scaleY * flipY})
    translate(-50 -50)
  `;
}