import {toast} from "sonner";
import type {DeviceAction, ParamAction} from "@/constants/contextMenuItems";
import type {NodeParamType} from "@/types/channelsTypes";
import {OpenCreateDeviveModal} from "@/components/ui/OpenCreateDeviceModal";
import {OpenCreateProjectModal, OpenCreateSiteModal} from "@/components/ui/OpenCreateContainerModal";
import {openGatewayExportModal} from "@/components/channels/OpenGatewayExportModal";
import {confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {
  createDeviceRequest, createParamRequest, deleteDeviceRequest, deleteImportedProjectRequest,
  deleteParamRequest, deleteParamUnchecked, errorMessage, patchParamsRequest,
} from "../api/devicesApi";
import {useDeviceTreeStore} from "./deviceTreeStore";
import {useDeviceLocksStore} from "./deviceLocksStore";
import {useDeviceDictionaries} from "./deviceDictionaries";

/**
 * Правка базы каналов: узлы, параметры, пункты контекстного меню дерева и параметров.
 * Запрос — в `devicesApi`, результат — в дерево (`useDeviceTreeStore`).
 */
const tree = useDeviceTreeStore;

export const addDevice = async (node: {type: number; idNode: string; parentKey: string}) => {
  let created: Awaited<ReturnType<typeof createDeviceRequest>>;
  try {
    created = await createDeviceRequest(node);
  } catch (err) {
    console.error('Ошибка при создании узла:', err);
    toast.error(errorMessage(err, 'Не удалось создать узел'));
    return;
  }
  const {nodeDTO, params} = created;

  const parts = nodeDTO.key.split('.');
  const title = parts.pop() || '';
  const parentKey = parts.join('.');

  const newNode = {
    key: nodeDTO.key,
    title: title,
    parentKey: parentKey,
  }

  tree.setState((state) => ({
    nodes: [...state.nodes, newNode],
    params: [...state.params, ...params],
  }));
};

export const removeDevice = async (key: string) => {
  try {
    await deleteDeviceRequest(key);
  } catch (err) {
    console.error('Ошибка при удалении узла:', err);
    toast.error(errorMessage(err, 'Не удалось удалить узел'));
    return;
  }

  tree.setState((state) => ({
    nodes: state.nodes.filter((n) => n.key !== key),
    params: state.params.filter((p) => p.parentKey !== key),
  }));
  toast.success('Узел удалён');
};

/**
 * Удаление импортированного проекта целиком. Отдельно от `removeDevice`: тот чистит
 * массив по точному ключу, а у проекта тысячи потомков — они остались бы сиротами.
 */
export const removeImportedProject = async (projectKey: string) => {
  const [site, project] = projectKey.split('.');
  if (!site || !project) return;

  try {
    await deleteImportedProjectRequest(site, project);
  } catch (err) {
    console.error('Ошибка при удалении импортированного проекта:', err);
    toast.error(errorMessage(err, 'Не удалось удалить проект'));
    return;
  }

  // Локально массив не правим: под проектом тысячи узлов, и фильтр по точному ключу
  // (как в removeDevice) оставил бы их в дереве без корня. Перечитываем то, что
  // осталось, и убираем проект из загруженных — иначе следующая загрузка запросила бы
  // уже несуществующий.
  const rest = (tree.getState().loadedRootPath ?? []).filter(p => p !== projectKey);
  tree.setState({loadedRootPath: rest, selectedDevice: null});
  if (rest.length) {
    await tree.getState().loadNodes(rest).catch(() => {});
  } else {
    tree.setState({nodes: [], params: []});
  }
  toast.success('Проект удалён');
};

export const deleteOptionParam = async (key: string) => {
  try {
    await deleteParamRequest(key);
  } catch (err) {
    console.error('Ошибка при удалении параметра:', err);
    toast.error(errorMessage(err, 'Не удалось удалить параметр'));
    return;
  }

  tree.setState((state) => ({
    params: state.params.filter(p => p.key !== key)
  }))
};

export const addParam = async (param: { id: number; value: string; parentKey: string }) => {
  let newParam: NodeParamType;
  try {
    newParam = await createParamRequest(param);
  } catch (err) {
    console.error('Ошибка при добавлении параметра:', err);
    toast.error(errorMessage(err, 'Не удалось добавить параметр'));
    return;
  }

  tree.setState((state) => ({
    params: [...state.params, newParam]
  }));
};

export const removeParam = async (key: string) => {
  try {
    await deleteParamUnchecked(key);

    tree.setState((state) => ({
      params: state.params.filter(p => p.key !== key),
    }));
  } catch (err) {
    console.error('Ошибка при удалении параметра:', err);
    throw err; // чтобы компонент мог отреагировать
  }
};

export const updateParam = async (changes: { key: string; value: string }[]) => {
  const updated = await patchParamsRequest(changes);

  const updatedList = updated.value;

  type paramFromServer = {
    key: string;
    value: string;
  }

  tree.setState((state) => {
    // Обновляем существующие
    const merged = state.params.map((param) => {
      const upd = updatedList.find((u: paramFromServer) => u.key === param.key);
      return upd ? {...param, value: upd.value} : param;
    });

    // Добавляем новые, которых не было
    const newParams = updatedList.filter((u: paramFromServer) => !state.params.some((p) => p.key === u.key));

    return {
      params: [...merged, ...newParams],
    };
  });
};

export const handleContextAction = async (action: DeviceAction, nodeKey: string | null) => {
  if (action === 'delete') {
    if (!nodeKey) return;
    const confirmed = await confirmModal({
      title: 'Удалить узел?',
      description: 'Узел и все дочерние элементы будут удалены. Действие необратимо.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (confirmed) {
      await removeDevice(nodeKey);
    }
  }
  if (action === 'add_site') {
    OpenCreateSiteModal();
  }
  if (action === 'add_project') {
    if (!nodeKey) return;
    OpenCreateProjectModal(nodeKey);
  }
  if (action === 'add') {
    await useDeviceDictionaries.getState().loadDeviceTemplateList();
    if (!nodeKey) return;
    OpenCreateDeviveModal(nodeKey);
  }
  if (action === 'edit') {
    await useDeviceLocksStore.getState().toggleEditing(tree.getState().selectedDevice ?? '');
  }
  if (action === 'export_gateway') {
    if (!nodeKey) return;
    openGatewayExportModal(nodeKey);
  }
  if (action === 'delete_import') {
    if (!nodeKey) return;
    const confirmed = await confirmModal({
      title: `Удалить проект ${nodeKey} целиком?`,
      description: 'Схемы, привязанные к его тегам, потеряют связь. Отмены нет: '
        + '«Отменить» в журнале действий импорт и удаление не откатывает.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (confirmed) {
      await removeImportedProject(nodeKey);
    }
  }
};

export const handleContextParamAction = async (action: ParamAction, paramKey: string | null) => {
  if (action === 'delete') {
    if (paramKey) await deleteOptionParam(paramKey);
  }
  if (action === 'add') {
    if (!tree.getState().selectedDevice) return;
    const id = useDeviceDictionaries.getState().paramsTypes
      .find(paramsType => paramsType.name === 'Общие параметры')?.id;
    const title = await promptModal({
      title: 'Новый параметр',
      label: 'Название параметра',
      placeholder: 'Например: Уставка давления',
      confirmLabel: 'Добавить',
    });
    if (title && id) {
      const newParam = {
        id: Number(id),
        value: title,
        parentKey: tree.getState().selectedDevice ?? ''
      };

      await addParam(newParam);
    }
  }
  if (action === 'edit') {
    const title = await promptModal({
      title: 'Переименовать параметр',
      label: 'Название параметра',
      confirmLabel: 'Сохранить',
    });
    if (title && paramKey) {
      const changes = [{key: paramKey, value: title}];
      await updateParam(changes);
    }
  }
};
