import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";

export function getRenderedElement(el: DiagramElement): DiagramElement {
  const {currentComponentStateByElementKey, runtimeOverridesByElementKey} = useEditorStore.getState();
  // Рантайм-оверрайды (setProp из биндингов монитора) ложатся ПОВЕРХ overrides
  // состояния; в редакторе карта пуста — поведение не меняется.
  const runtimeOverrides = runtimeOverridesByElementKey[el.key];

  const currentComponentStateId = currentComponentStateByElementKey[el.key]
    ?? el.states.find(s => s.isDefault)?.id
    ?? el.states[0]?.id;

  const state = currentComponentStateId
    ? el.states.find(s => s.id === currentComponentStateId)
    : undefined;

  if (!state && !runtimeOverrides) return el;

  return {
    ...el,
    ...(state?.overrides ?? {}),
    ...(runtimeOverrides ?? {}),
  };
}
