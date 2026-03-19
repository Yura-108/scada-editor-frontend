"use client";

import {useModalStore} from "@/store/modalStore";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import {useDeviceStore} from "@/store/useDeviceStore";
import {useEditorStore} from "@/store/useEditorStore";


interface Props {
  component_id: number;
}

export function ChooseTagContent({component_id}: Props) {
  const {closeModal} = useModalStore.getState();
  const {selectedDevice} = useDeviceStore();
  const {addTags} = useEditorStore();

  const handleConfirm = async () => {
    if (!selectedDevice) return;
    await addTags(component_id, selectedDevice)
    closeModal();
  };
  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Выберите схему для загрузки
      </Dialog.Title>

      <Dialog.Description className="text-gray-400 mb-6 text-sm">
        Загрузите одну из сохранённых сцен.
      </Dialog.Description>

      <Select.Root>
        <DeviceTreePanel />
      </Select.Root>

      {/* Кнопки внизу */}
      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-900/30 transition-all"
        >
          Выбрать
        </button>
      </div>
    </>
  )
}

export function OpenChooseTagModal(component_id: number) {
  const {openModal} = useModalStore.getState();

  openModal(<ChooseTagContent component_id={component_id} />);
}

