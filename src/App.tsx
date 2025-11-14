import './App.css';
import DeviceTreePanel from "./components/DeviceTreePanel/DeviceTreePanel.tsx";
import MainLayout from "./layout/MainLayout/MainLayout.tsx";
import HeaderBar from "./components/HeaderBar/HeaderBar.tsx";
import StartMenu from "./components/StartMenu/StartMenu.tsx";
import {useEffect, useState} from "react";
import type {TreeProps} from "rc-tree";
import DeviceParams from "./components/DeviceParams/DeviceParams.tsx";
import type {DeviceNodeType, DeviceParamsType} from "./types/nodeType.ts";
import type {ContextMenuState} from "./types/ContextMenuState.ts";
import {applyChangesParams} from "./utils/applyChangesParams.ts";
import type {EventDataNode} from 'rc-tree/lib/interface';
import type {DataNode} from "rc-tree/es/interface";

function App() {
  const [isDirty, setIsDirty] = useState(false);
  const [visibleTree, setVisibleTree] = useState<boolean>(false);
  const [visibleDeviceParams, setVisibleDeviceParams] = useState<boolean>(false);
  const [treeData, setTreeData] = useState<DeviceNodeType[]>([]);
  const [initialDeviceParams, setInitialDeviceParams] = useState<DeviceParamsType[]>([]);
  const [deviceParams, setDeviceParams] = useState<DeviceParamsType[]>([]);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null
  });

  const handleSelect: TreeProps['onSelect'] = async (selectedKeys) => {
    const newKey = selectedKeys[0] as string;

    if (!newKey || newKey === selectedDeviceKey) return;

    if (isDirty) {
      const confirm = window.confirm("Сохранить изменения?");
      if (confirm) {
        const form = document.querySelector<HTMLFormElement>('form.params');
        if (form) {
          await applyChangesParams(form, deviceParams, setIsDirty, setInitialDeviceParams);
        }
        setIsDirty(false);
      } else {
        setIsDirty(false);
      }
    }
    setSelectedDeviceKey(newKey);
    setDeviceParams(initialDeviceParams.filter(param => param.parentKey === selectedKeys[0]));
    setVisibleDeviceParams(true);
  };

  const handleRightClick = (info: {
    event: React.MouseEvent;
    node: EventDataNode<DataNode>;
  }) => {
    setContextMenu({
      visible: true,
      x: info.event.clientX,
      y: info.event.clientY,
      node: info.node,
    });
  };
  useEffect(() => {
    console.log(initialDeviceParams);
  }, [initialDeviceParams]);
  return (
    <>
      <HeaderBar />
      <StartMenu
        setTreeData={setTreeData}
        setInitialDeviceParams={setInitialDeviceParams}
        setVisibleTree={setVisibleTree}
      />

      {visibleTree &&
          <MainLayout>
            <DeviceTreePanel
                setInitialDeviceParams={setInitialDeviceParams}
                treeData={treeData}
                handleSelect={handleSelect}
                handleRightClick={handleRightClick}
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
                setTreeData={setTreeData}
            />
            {visibleDeviceParams &&
                <DeviceParams
                  isDirty={isDirty}
                  setIsDirty={setIsDirty}
                  deviceParams={deviceParams}
                  setInitialDeviceParams={setInitialDeviceParams}
                  nodeType={selectedDeviceKey ?? ""}
                />
            }
          </MainLayout>}
    </>
  )
}

export default App
