export default function isIntersecting(
  rect: { x: number; y: number; width: number; height: number },
  el: { x: number; y: number; w: number; h: number }
) {
  return !(
    el.x > rect.x + rect.width ||
    el.x + el.w < rect.x ||
    el.y > rect.y + rect.height ||
    el.y + el.h < rect.y
  );
}