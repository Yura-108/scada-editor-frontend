// База каналов: дерево устройств и параметры, блокировки правки, справочники, правка дерева.
// Общая для «Каналов», редактора (выбор тегов) и «Автоматизации». Внутри core/devices файлы
// импортируют друг друга относительно, а не через этот index.
export {useDeviceTreeStore} from "./model/deviceTreeStore";
export {useDeviceLocksStore} from "./model/deviceLocksStore";
export {useDeviceDictionaries} from "./model/deviceDictionaries";
export * from "./model/deviceActions";
export {useEditingDevices} from "./model/useIsEditingDevice";
export {useUnlockEditingOnUnload} from "./model/useUnlockEditingOnUnload";

// Чистые функции
export * from "./lib/deviceTreeData";
export * from "./lib/paramWidget";

// UI: дерево с меню правки и выбором проекта, модалки меню
export {default as DeviceTreePanel} from "./ui/DeviceTreePanel";
export {default as ChannelsProjectPicker} from "./ui/ChannelsProjectPicker";
export {default as DeviceContextMenu} from "./ui/DeviceContextMenu";
export {openChooseParamTypeModal} from "./ui/modals/OpenChooseParamTypeModal";
export {pickTag, pickTags} from "./ui/tag-picker/pickTag";
export {TagTree} from "./ui/tag-picker/TagTree";
