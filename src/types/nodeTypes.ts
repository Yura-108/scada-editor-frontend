export interface nodeType {
  key: string;
  title: string;
  children?: nodeType[];
  isLeaf: boolean;
}

export type DeviceNodeType = {
  key: string;
  title: string;
  isLeaf: boolean;
  parentKey?: string;
};

export type DeviceParamsType = {
  key: string;
  parentKey: string;
  name: string;
  type: string;
  value: string;
};
export type DeviceParamsFromAddFunc = {
  parentKey: string;
  name: string;
  value: string;
};

export type DeviceTreeResponse = {
  nodes: DeviceNodeType[];
  params: DeviceParamsType[];
};
