import type {DataNode} from 'rc-tree/es/interface';

export type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  node: DataNode | null;
};
