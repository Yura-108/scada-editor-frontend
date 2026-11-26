import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionUserStore } from '@/core/access';
import {
  buildPaletteComponentTree,
  getRenderedElement,
  type ComponentCreateDto,
  type DiagramElement,
} from '@/core/scene';
import { useEditorStore } from '@/modules/editor/model/editorStore';
import { applyLoadedScene } from '@/modules/editor/model/editorStoreInternals';
import { buildNewElement } from '@/modules/editor/model/newElement';

type SavedNode = Omit<ComponentCreateDto, 'id' | 'children'> & {
  id: number;
  children: SavedNode[];
};

const scene = { id: 71, project_id: 7, name: 'Схема для проверки', type: 'scene' };
const store = useEditorStore;
const element = (key: string) => store.getState().elements.find((item) => item.key === key)!;

/** Сначала сервер удаляет отсутствующие поддеревья, затем ищет ID из запроса. */
function sceneGateway() {
  let saved: SavedNode[] = [];
  let version = 0;
  let nextId = 100;
  const requests: ComponentCreateDto[][] = [];

  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    expect(url).toBe('/api/editor/components');
    expect(init?.method).toBe('PUT');
    const request = JSON.parse(String(init?.body)) as {
      components: ComponentCreateDto[];
      scene_id: number;
      based_on_version?: number;
    };
    expect(request.scene_id).toBe(scene.id);
    expect(request.based_on_version).toBe(version || undefined);
    requests.push(request.components);

    const requestedIds = new Set<number>();
    const collect = (nodes: ComponentCreateDto[]) => {
      for (const node of nodes) {
        if (node.id != null) requestedIds.add(node.id);
        collect(node.children);
      }
    };
    collect(request.components);

    const retainedIds = new Set<number>();
    const prune = (nodes: SavedNode[]) => {
      for (const node of nodes) {
        if (!requestedIds.has(node.id)) continue;
        retainedIds.add(node.id);
        prune(node.children);
      }
    };
    prune(saved);

    const persist = (node: ComponentCreateDto, parentId: number): SavedNode => {
      if (node.id != null && !retainedIds.has(node.id)) {
        throw new Error(`Component not found: ${node.id}`);
      }
      if (node.id == null) {
        for (const row of [
          ...node.states,
          ...node.scripts,
          ...node.bindings,
          ...node.events,
          ...(node.properties ?? []),
        ]) {
          if (row.id != null)
            throw new Error(`ID ${row.id} не принадлежит новому узлу ${node.key}`);
        }
      }
      const id = node.id ?? nextId++;
      return {
        ...node,
        id,
        parent_id: parentId,
        states: node.states.map((state) => ({ ...state, id: state.id ?? nextId++ })),
        scripts: node.scripts.map((script) => ({ ...script, id: script.id ?? nextId++ })),
        events: node.events.map((event) => ({ ...event, id: event.id ?? nextId++ })),
        bindings: node.bindings.map((binding) => ({ ...binding, id: binding.id ?? nextId++ })),
        properties: (node.properties ?? []).map((property) => ({
          ...property,
          id: property.id ?? nextId++,
          component_id: id,
        })),
        children: node.children.map((child) => persist(child, id)),
      };
    };
    try {
      saved = request.components.map((node) => persist(node, scene.id));
      return Response.json({ components: saved, version_no: ++version });
    } catch (error) {
      return Response.json({ message: (error as Error).message }, { status: 400 });
    }
  });

  return {
    fetch,
    requests,
    reload: () =>
      applyLoadedScene({ ...scene, children: JSON.parse(JSON.stringify(saved)) }, version),
  };
}

let gateway: ReturnType<typeof sceneGateway>;

beforeEach(() => {
  store.setState(store.getInitialState());
  store.temporal.getState().clear();
  useSessionUserStore.getState().setUser({ login: 'tester', admin: true });
  store.setState({ currentProject: { id: 7, name: 'Тестовый проект' } });
  applyLoadedScene({ ...scene, children: [] }, null);
  gateway = sceneGateway();
  vi.stubGlobal('fetch', gateway.fetch);
});

afterEach(() => vi.unstubAllGlobals());

function exampleShapes() {
  const circle = buildNewElement('circle', 100, 100, scene.id);
  const arc = buildNewElement('arc', 200, 100, scene.id);
  const checkbox = buildNewElement('checkbox', 300, 100, scene.id);
  const text = buildNewElement('text', 400, 100, scene.id);
  text.states[0].overrides = {
    ...text.states[0].overrides,
    text: 'Пуск линии',
  } as DiagramElement['states'][number]['overrides'];
  return { circle, arc, checkbox, text };
}

function createComponent(members: DiagramElement[], others: DiagramElement[] = []) {
  store.setState({
    elements: [...members, ...others],
    selectedIds: members.map((item) => item.key),
  });
  store.getState().groupSelected();
  const [groupKey] = store.getState().selectedIds;
  store.getState().createComponentFromGroup(groupKey, 'Управление');
  return groupKey;
}

describe('Сохранение компонентов в редакторе', () => {
  it('сохраняет названия, текст и подпись флажка в сцене и в шаблоне', async () => {
    const { circle, arc, checkbox, text } = exampleShapes();
    const groupKey = createComponent([circle, arc, checkbox, text]);
    const palette = buildPaletteComponentTree(
      store.getState().elements,
      groupKey,
    ) as ComponentCreateDto;
    expect(JSON.parse(palette.states[0].image).composition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: circle.key, label: 'Круг 1' }),
        expect.objectContaining({ key: text.key, label: 'Текст 1', text: 'Пуск линии' }),
        expect.objectContaining({ key: checkbox.key, label: 'Флажок' }),
      ]),
    );

    expect(await store.getState().exportScene({ silent: true })).toBe(true);
    expect(gateway.reload()).toBe(true);
    expect(element(circle.key).label).toBe('Круг 1');
    expect(element(arc.key).label).toBe('Дуга 1');
    expect(element(text.key).label).toBe('Текст 1');
    expect(getRenderedElement(element(text.key))).toMatchObject({ text: 'Пуск линии' });
    expect(getRenderedElement(element(checkbox.key))).toMatchObject({ label: 'Флажок' });
  });

  it('сохраняет бывших детей после разбора, сохранения, перезагрузки и разгруппировки', async () => {
    const { circle, text } = exampleShapes();
    circle.properties = [
      {
        name: 'Level',
        component_id: null,
        property_type: 'Тег',
        tag_id: 'Test.Level',
        value_type: 'integer',
        default_value: '12',
        logging: true,
        onChange: '',
        access_level: 1,
        OnCanChange: '',
      },
    ];
    const sibling = buildNewElement('rectangle', 500, 100, scene.id);
    const groupKey = createComponent([circle, text], [sibling]);
    expect(await store.getState().exportScene({ silent: true })).toBe(true);

    store.getState().disassembleComponent(groupKey);
    expect(await store.getState().exportScene({ silent: true })).toBe(true);
    expect(gateway.reload()).toBe(true);
    const idsBefore = [circle, text].map((item) => element(item.key).id);
    const siblingId = element(sibling.key).id;
    const oldPropertyId = element(circle.key).properties[0].id!;
    store.setState(({ elements }) => ({
      elements: elements.map((item) =>
        item.key === sibling.key
          ? {
              ...item,
              bindings: [
                {
                  v: 1,
                  id: 'level-binding',
                  name: 'Показать уровень',
                  enabled: true,
                  code: 'return level;',
                  propertyRefs: [
                    {
                      componentKey: circle.key,
                      componentId: element(circle.key).id,
                      componentLabel: 'Круг 1',
                      propertyName: 'Level',
                      propertyId: oldPropertyId,
                      varName: 'level',
                    },
                  ],
                },
              ],
            }
          : item,
      ),
    }));

    store.setState({ selectedIds: [groupKey] });
    await store.getState().ungroupSelected();
    expect(await store.getState().exportScene({ silent: true })).toBe(true);
    const request = gateway.requests.at(-1)!;
    expect(request.map((item) => item.key)).toEqual(
      expect.arrayContaining([circle.key, text.key, sibling.key]),
    );
    expect(request.some((item) => item.key === groupKey)).toBe(false);
    expect(request.find((item) => item.key === sibling.key)?.id).toBe(siblingId);
    expect(request.find((item) => item.key === circle.key)).toMatchObject({
      id: null,
      parent_id: scene.id,
      properties: [
        expect.objectContaining({ name: 'Level', component_id: null, tag_id: 'Test.Level' }),
      ],
    });
    const binding = request.find((item) => item.key === sibling.key)!.bindings[0];
    expect(JSON.parse(binding.script).propertyRefs).toMatchObject([
      {
        componentKey: circle.key,
        componentId: null,
        propertyName: 'Level',
      },
    ]);
    expect(JSON.parse(binding.script).propertyRefs[0]).not.toHaveProperty('propertyId');
    expect(gateway.reload()).toBe(true);
    expect([circle, text].map((item) => element(item.key).id)).not.toEqual(idsBefore);
    expect(element(circle.key)).toMatchObject({ label: 'Круг 1', parentKey: String(scene.id) });
    const updatedPropertyId = element(circle.key).properties[0].id!;
    expect(updatedPropertyId).not.toBe(oldPropertyId);
    expect(element(sibling.key).bindings[0].propertyRefs).toMatchObject([
      {
        propertyId: updatedPropertyId,
        componentId: element(circle.key).id,
      },
    ]);
    expect(getRenderedElement(element(text.key))).toMatchObject({
      text: 'Пуск линии',
      x: text.x,
      y: text.y,
    });
    expect(await store.getState().exportScene({ silent: true })).toBe(true);
  });
});
