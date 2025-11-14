import type {DeviceNodeType, DeviceParamsFromAddFunc} from "../types/nodeType.ts";


type nodeType = {
  nodeDTO: DeviceNodeType[];
  params: DeviceNodeType[];
}
// Добавление узла (подтип или канал)
export const addNode = async (node: DeviceNodeType): Promise<nodeType> => {
  const response = await fetch('http://localhost:8080/api/node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(node),
  });


  if (!response.ok) {
    throw new Error(`Ошибка добавления узла: ${response.statusText}`);
  }

  return await response.json();
};

// Удаление узла и его потомков
export const deleteNode = async (key: string): Promise<void> => {
  const response = await fetch(`http://localhost:8080/api/node/${key}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Ошибка при удалении узла');
  }
};

export const addParam = async (param: DeviceParamsFromAddFunc) => {
  const response = await fetch('http://localhost:8080/api/param', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(param),
  });
  if (!response.ok) {
    throw new Error(`Ошибка добавления параметра: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

export const deleteParam = async (key: string): Promise<void> => {
  const response = await fetch(`http://localhost:8080/api/param/${key}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Ошибка при удалении узла');
  }
};

export const patchParam = async (value: {key: string, value: string}[]) => {
  const response = await fetch(`http://localhost:8080/api/param/update`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    throw new Error(`Ошибка при обновлении параметра: ${response.status}`);
  }

  return await response.json(); // если сервер что-то возвращает
};







