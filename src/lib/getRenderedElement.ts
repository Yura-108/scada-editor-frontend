import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";

export function getRenderedElement(el: DiagramElement): DiagramElement {
  const {currentComponentStateByElementKey} = useEditorStore.getState();
  const currentComponentStateId = currentComponentStateByElementKey[el.key];

  if (!currentComponentStateId) return el;

  const state = el.states.find(s => s.id === currentComponentStateId);

  if (!state) return el;

  return {
    ...el,
    ...state.overrides,
  };
}