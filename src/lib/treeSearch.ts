import { DeviceNodeType} from '@/types/nodeTypes';
import {NodeType} from "@/types/channelsTypes";

export const treeSearch = (key: string, nodes: NodeType[]) => {
  return nodes.filter(node => node.key.startsWith(key)).map(node => node.key);
}