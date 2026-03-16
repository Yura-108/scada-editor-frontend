export const getDescription = (type: string, entity: string, id: number) => {
  const isNode = entity === 'Node';

  const translations: Record<string, string> = {
    CREATE: isNode ? 'Было создано устройство' : 'Был создан параметр',
    DELETE: isNode ? 'Было удалено устройство' : 'Был удален параметр',
    UPDATE: isNode ? 'Было обновлено устройство' : 'Был обновлен параметр',
  };

  const action = translations[type] || 'Действие над объектом';
  return `${action} с ID: ${id}`;
};