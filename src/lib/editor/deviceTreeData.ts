import type {ReactNode} from "react";
import type {DataNode} from "rc-tree/es/interface";

/**
 * Сборка дерева `rc-tree` из ПЛОСКОГО списка узлов базы каналов.
 *
 * Иерархия закодирована в самом ключе — это путь через точку
 * (`площадка.проект.устройство.подустройство.канал`), отдельного поля-родителя у DTO нет.
 * Поэтому ключ режется по точкам, а промежуточные сегменты, у которых нет собственного
 * узла, достраиваются синтетическими (`{key, title: <сегмент>}`).
 *
 * `isLeaf` вычисляется по ходу: узел считается листом, пока ему не добавили ребёнка.
 * Из-за этого подпись узла строится ленивой функцией — на момент создания узла ещё не
 * известно, лист он или нет, а к моменту рендера объект уже дособран.
 *
 * Вынесено из DeviceTreePanel, чтобы модалка выбора тегов строила ровно то же дерево:
 * это единственное место, где знание «ключ = путь» превращается в структуру.
 */

/** Узел базы каналов в том виде, в каком его отдаёт стор. */
export interface FlatDeviceNode {
  key: string;
  title?: string;
  parentKey?: string;
}

/** Данные узла, доступные функции подписи: реальные, если узел настоящий. */
export interface DeviceTreeNodeInfo {
  key: string;
  title: string;
  isLeaf: boolean;
}

export function buildDeviceTreeData(
  nodes: FlatDeviceNode[],
  renderTitle: (info: DeviceTreeNodeInfo) => ReactNode,
): DataNode[] {
  const map = new Map<string, DataNode>();
  const roots: DataNode[] = [];
  // Данные для подписи держим отдельно: сам DataNode хранит только то, что нужно rc-tree.
  const infoByKey = new Map<string, {title: string}>();

  nodes.forEach(node => {
    const parts = node.key.split(".");
    let currentKey = "";

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const parentKey = currentKey;
      currentKey = currentKey ? `${currentKey}.${part}` : part;

      // Реальный узел знает свою подпись; синтетический сегмент зовётся своим именем.
      const title = isLast ? (node.title ?? part) : part;
      if (isLast || !infoByKey.has(currentKey)) {
        infoByKey.set(currentKey, {title});
      }

      const existing = map.get(currentKey);
      if (existing) return;

      // Ссылку на узел фиксируем до подписи: подпись читает `newNode.isLeaf` в момент
      // рендера, когда все дети уже добавлены.
      const newNode = {key: currentKey, children: [], isLeaf: true} as DataNode;
      const nodeKey = currentKey;
      newNode.title = () => renderTitle({
        key: nodeKey,
        title: infoByKey.get(nodeKey)?.title ?? nodeKey,
        isLeaf: newNode.isLeaf !== false,
      });

      map.set(currentKey, newNode);

      const parent = parentKey ? map.get(parentKey) : undefined;
      if (parent) {
        parent.children!.push(newNode);
        parent.isLeaf = false;
      } else if (!parentKey) {
        roots.push(newNode);
      }
    });
  });

  return roots;
}

/**
 * Ключи листьев поддерева — то, что реально является тегом.
 *
 * `rc-tree` с `checkable` отдаёт отмеченными и промежуточные узлы; в набор тегов должны
 * попасть только конечные каналы, иначе устройство приехало бы в таблицу отдельной
 * строкой без значения.
 */
export function leafKeysOf(nodes: FlatDeviceNode[]): Set<string> {
  const parents = new Set<string>();
  for (const node of nodes) {
    const parts = node.key.split(".");
    for (let i = 1; i < parts.length; i++) {
      parents.add(parts.slice(0, i).join("."));
    }
  }
  return new Set(nodes.map(n => n.key).filter(key => !parents.has(key)));
}

/**
 * Все ключи дерева, включая достроенные промежуточные сегменты.
 *
 * Нужно, чтобы отличить «узел сейчас в дереве» от «узел отфильтрован»: `rc-tree`
 * пересчитывает отмеченные ключи по ТЕКУЩЕМУ `treeData`, и без такого разделения
 * галочки, поставленные до фильтра, молча пропадали бы при следующем клике.
 */
export function allTreeKeys(nodes: FlatDeviceNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    const parts = node.key.split(".");
    for (let i = 1; i <= parts.length; i++) {
      keys.add(parts.slice(0, i).join("."));
    }
  }
  return keys;
}
