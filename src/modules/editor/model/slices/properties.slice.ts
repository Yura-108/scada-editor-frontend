import {DiagramElement} from "@/types/editorElement.type";
import {purgePropertyRefs} from "../propertyDependents";
import {toast} from "sonner";
import {PropertyCreateDto, PropertyCreateRequestDto} from "@/types/tags.types";
import {TagBinding} from "@/types/binding.types";
import type {EditorState} from "../editorStore";
import {editorSession} from "../editorSession";
import {
  adoptPropertyEditVersion, canWriteCurrentProject, renamePropertyOnServer,
} from "../editorStoreInternals";

/**
 * Зона «Свойства и привязки» документа стора редактора. Свойства элемента (локальные правки, едут
 * со сценой) и CRUD привязок. Правила — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6); правит `elements`,
 * поэтому всё здесь идёт в undo и в сохранение. Код перенесён без изменений.
 */
export interface PropertiesSlice {
  /** Заводит свойство локально; уедет со сценой. false — имя занято. */
  addProperty: (elementKey: string, payload: PropertyCreateRequestDto) => boolean;
  /** Правит свойство локально. Переименование заведённого дополнительно уходит точечным
   *  PUT — только он переносит значения наборов на новое имя. false — отказ. */
  editProperty: (
    elementKey: string,
    target: PropertyCreateDto,
    payload: PropertyCreateRequestDto,
  ) => Promise<boolean>;
  /** Удаляет свойство локально + убирает ссылки на него по сцене. */
  deleteProperty: (elementKey: string, target: PropertyCreateDto) => void;
  /** CRUD биндингов (JS-скрипты монитора) — design-time правки, попадают в undo. */
  addBinding: (elementKey: string, binding: TagBinding) => void;
  updateBinding: (elementKey: string, bindingId: string, patch: Partial<Omit<TagBinding, "v" | "id">>) => void;
  removeBinding: (elementKey: string, bindingId: string) => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createPropertiesSlice = (set: EditorSet, get: () => EditorState): PropertiesSlice => ({
  /**
   * Свойства — обычная часть сцены, а не отдельный ресурс.
   *
   * Раньше каждая правка уходила своим запросом (`/api/editor/tags`), и из-за этого
   * свойство нельзя было завести элементу, которого ещё нет на сервере: серверный
   * `component_id` появлялся только после сохранения. Теперь свойство правится
   * локально и уезжает вместе со сценой одним PUT — бэкенд принимает весь список в
   * `ComponentCreateDto.properties`, сам заводит новые и привязывает к ним биндинги
   * по `component_property_name`.
   *
   * Адресуем КЛЮЧОМ элемента, а не серверным `component_id`: у несохранённого
   * элемента тот равен null и совпал бы с любым другим несохранённым.
   *
   * Следствия: правки попадают в undo (им там и место — они локальные) и помечают
   * сцену изменённой. Сеть остаётся ровно в одном месте — переименовании.
   */
  addProperty: (elementKey, payload) => {
    const owner = get().elements.find(el => el.key === elementKey);
    if (!owner) return false;

    const name = payload.name.trim();
    // Имя — ключ сопоставления на бэкенде (сначала по id, потом по имени), поэтому
    // дубль в пределах компонента сделал бы сопоставление неоднозначным.
    if ((owner.properties ?? []).some(p => p.name.trim() === name)) {
      toast.error(`Свойство «${name}» у этого элемента уже есть`);
      return false;
    }

    set(state => ({
      elements: state.elements.map(el => el.key === elementKey
        ? {...el, properties: [...(el.properties ?? []), {...payload, name}]} as DiagramElement
        : el),
    }));
    return true;
  },
  editProperty: async (elementKey, target, payload) => {
    const owner = get().elements.find(el => el.key === elementKey);
    if (!owner) return false;

    const name = payload.name.trim();
    const isSame = (p: PropertyCreateDto) => target.id != null
      ? p.id === target.id
      : p.id == null && p.name === target.name;

    if ((owner.properties ?? []).some(p => !isSame(p) && p.name.trim() === name)) {
      toast.error(`Свойство «${name}» у этого элемента уже есть`);
      return false;
    }

    // ЕДИНСТВЕННЫЙ оставшийся сетевой вызов.
    //
    // Раньше он был нужен ради рецептов: их значения ключевались ИМЕНЕМ свойства и
    // переезжали на новое имя только этим точечным PUT. С 09.09.2026 рецепт — процедура
    // над ТЕГАМИ, о свойствах компонента он не знает вовсе, и той причины не осталось.
    // Вызов сохранён: что ещё делает `PUT /api/editor/properties/{id}` на бэкенде,
    // отсюда не видно, и убирать его надо отдельно и осознанно.
    // Без права правки переименование остаётся локальным, как и любая правка в режиме
    // просмотра: серверный PUT ответил бы 403 и не дал бы «потыкать» схему.
    if (target.id != null && target.name.trim() !== name && canWriteCurrentProject()) {
      const {currentProject, scene} = get();
      const generation = editorSession.documentGeneration;
      const renamed = await renamePropertyOnServer(target.id, {...payload, name});
      if (!renamed.ok) return false;
      // Номер версии — ДО локального применения имени (контракт scada-r9lr).
      adoptPropertyEditVersion(currentProject?.id, scene?.id, generation, renamed.versionNo);
    }

    set(state => ({
      elements: state.elements.map(el => el.key === elementKey
        ? {
          ...el,
          properties: (el.properties ?? []).map(p =>
            isSame(p) ? {...p, ...payload, name} : p),
        } as DiagramElement
        : el),
    }));
    return true;
  },
  deleteProperty: (elementKey, target) => {
    // Просмотр версии — режим только для чтения.
    if (get().versionPreview) return;

    const owner = get().elements.find(el => el.key === elementKey);
    if (!owner) return;

    set(state => {
      // У заведённого свойства могут быть ссылки по номеру: висячий
      // `component_property_id` роняет сохранение ВСЕЙ сцены 400-м, а висячий
      // propertyRef тихо ломает логику (см. lib/editor/propertyDependents.ts).
      // У черновика номера нет — ссылаться на него по номеру нечему.
      if (target.id != null && owner.id != null) {
        return {elements: purgePropertyRefs(state.elements, target.id, owner.id)};
      }
      return {
        elements: state.elements.map(el => el.key === elementKey
          ? {...el, properties: (el.properties ?? []).filter(p => p !== target && p.name !== target.name)} as DiagramElement
          : el),
      };
    });
  },
  // Биндинги — клиентские данные (уезжают на сервер только с сохранением сцены),
  // поэтому их правки, в отличие от addTags/editProperty, ДОЛЖНЫ попадать в undo.
  addBinding: (elementKey, binding) => set(state => ({
    elements: state.elements.map(el =>
      el.key === elementKey
        ? {...el, bindings: [...(el.bindings ?? []), binding]} as DiagramElement
        : el
    ),
  })),
  updateBinding: (elementKey, bindingId, patch) => set(state => ({
    elements: state.elements.map(el =>
      el.key === elementKey
        ? {
            ...el,
            bindings: (el.bindings ?? []).map(b =>
              b.id === bindingId ? {...b, ...patch} : b
            ),
          } as DiagramElement
        : el
    ),
  })),
  removeBinding: (elementKey, bindingId) => set(state => ({
    elements: state.elements.map(el =>
      el.key === elementKey
        ? {...el, bindings: (el.bindings ?? []).filter(b => b.id !== bindingId)} as DiagramElement
        : el
    ),
  })),
});
