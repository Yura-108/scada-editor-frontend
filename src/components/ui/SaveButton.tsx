import {Save} from 'lucide-react';
import {useDeviceStore} from '@/store/useDeviceStore';

export default function SaveButton() {
  const {getParams, updateParam} = useDeviceStore();

  const handleSaveAllDrafts = async () => {
    // setIsSaving(true);

    try {
      // Проходим по всем ключам localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('device-params-draft:')) continue;

        const deviceId = key.replace('device-params-draft:', '');
        const draftJson = localStorage.getItem(key);
        if (!draftJson) continue;

        const draft = JSON.parse(draftJson);

        // Проверяем, что устройство существует
        const params = getParams(deviceId);
        if (!params?.length) {
          localStorage.removeItem(key);
          continue;
        }

        // Собираем изменения для конкретного устройства
        const changes: { key: string; value: string }[] = [];

        Object.entries(draft).forEach(([paramKey, value]) => {
          const param = params.find(p => String(p.key) === paramKey);
          if (param && (param.value ?? '') !== value) {
            changes.push({key: paramKey, value: value as string});
          }
        });

        // Если изменений нет — просто очищаем черновик
        if (changes.length === 0) {
          localStorage.removeItem(key);
          continue;
        }

        // Отправляем изменения на сервер
        await updateParam(changes);

        // Успешно — очищаем черновик
        localStorage.removeItem(key);
      }

      // setSaveStatus('success');
    } catch (err) {
      // setSaveStatus('error');
    } finally {
      // setIsSaving(false);
    }
  };

  return (
    <button
      onClick={handleSaveAllDrafts}
      //disabled={!hasChanges || isSaving}
      // className={clsx(
      //   'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-white transition-all transform',
      //   hasChanges
      //     ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 shadow-xl'
      //     : 'bg-gray-400 cursor-not-allowed',
      //   isSaving && 'opacity-70 cursor-wait',
      // )}
    >
      <Save className="w-5 h-5"/>
      {/*{isSaving ? 'Сохранение...' : 'Сохранить изменения'}*/}
      Сохранить изменения
    </button>
  )
}