import type {DataNode} from "rc-tree/es/interface";

export const convertToDataNode = (nodes: DeviceNode[]): DataNode[] => {
  return nodes.map((node) => ({
    title: node.title,
    key: node.key,
    isLeaf: node.isLeaf,
  }));
};