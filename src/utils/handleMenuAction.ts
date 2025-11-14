import {addNode, deleteNode} from "./treeApi.ts";
import type {DeviceNodeType, DeviceParamsType} from "../types/nodeType.ts";
import type {ContextMenuState} from "../types/ContextMenuState.ts";
import * as React from "react";

export const handleMenuAction = async (
  action: string,
  contextMenu: ContextMenuState,
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>,
  setTreeData: React.Dispatch<React.SetStateAction<DeviceNodeType[]>>,
  setInitialDeviceParams: React.Dispatch<React.SetStateAction<DeviceParamsType[]>>
) => {
  const targetNode = contextMenu.node;
  switch (action) {
    case 'Удалить': {
      const nodeKey = targetNode?.key as string;
      if (!nodeKey) break;

      try {
        await deleteNode(nodeKey);

        const deleteRecursively = (keyToDelete: string, nodes: DeviceNodeType[]): DeviceNodeType[] => {
          const children = nodes.filter(n => n.parentKey === keyToDelete);
          let remaining = nodes.filter(n => n.key !== keyToDelete);
          for (const child of children) {
            remaining = deleteRecursively(child.key, remaining);
          }
          return remaining;
        };

        setTreeData(prev => deleteRecursively(nodeKey.toString(), prev as DeviceNodeType[]));
      } catch (error) {
        console.error('Ошибка при удалении:', error);
        alert('Не удалось удалить узел. Попробуйте ещё раз.');
      }
      break;
    }
    case 'Добавить подтип': {
      const newName = prompt('Введите название подтипа:');

      if (!newName) break;

      const tempNode = {
        type: "sub",
        title: newName,
        isLeaf: false,
        parentKey: targetNode?.key as string,
      };

      try {
        const {nodeDTO, params} = await addNode(tempNode);
        setTreeData(prev => [...prev, nodeDTO]);
        setInitialDeviceParams(prev => [...prev, ...params]);
      } catch (error) {
        console.error('Ошибка при добавлении:', error);
        alert('Не удалось добавить узел. Попробуйте ещё раз.');
      }
      break;
    }
    case 'Добавить канал': {
      const newName = prompt('Введите название канала:');
      if (!newName) break;

      const tempNode = {
        type: "cha",
        title: newName,
        isLeaf: true,
        parentKey: targetNode?.key as string,
      };

     try {
       const {nodeDTO, params} = await addNode(tempNode);
       setTreeData(prev => [...prev, nodeDTO]);
       setInitialDeviceParams(prev => [...prev, ...params]);
     } catch (error) {
       console.error('Ошибка при добавлении:', error);
       alert('Не удалось добавить узел. Попробуйте ещё раз.');
     }
      break;
    }
  }

  setContextMenu((prev) => ({ ...prev, visible: false }));
};
