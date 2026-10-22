import { TreeNodeProps } from 'rc-tree';
import { DataNode } from 'rc-tree/es/interface';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

const SwitcherIcon = ({ expanded, isLeaf }: TreeNodeProps<DataNode>) => {
  if (isLeaf) return null;
  return expanded ? (
    <ChevronDown className="w-4 h-4 text-gray-500" />
  ) : (
    <ChevronRight className="w-4 h-4 text-gray-500" />
  );
};

export default SwitcherIcon;
