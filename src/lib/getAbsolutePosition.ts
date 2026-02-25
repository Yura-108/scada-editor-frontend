export default function getAbsolutePosition(
  element: BaseElement,
  elements: BaseElement[]
) {
  let x = element.x;
  let y = element.y;

  let parent = elements.find(e => e.id === element.parentId);

  while (parent) {
    x += parent.x;
    y += parent.y;
    parent = elements.find(e => e.id === parent.parentId);
  }

  return { x, y };
}