"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {ChevronDown, Waypoints} from "lucide-react";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import SelectItem from "@/components/ui/SelectItem";
import {selectContentClassName, selectIconClassName, selectTriggerClassName} from "@/components/ui/selectStyles";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {ComponentPropertyDto} from "@/types/editorElement.type";

interface Props {
  row: number;
  binding?: ComponentPropertyDto;
  onConfirm: (binding: ComponentPropertyDto) => void;
}

const valueTypeOptions: Array<{value: string; label: string}> = [
  {value: "string", label: "string"},
  {value: "integer", label: "integer"},
  {value: "float", label: "float"},
  {value: "number", label: "number"},
  {value: "boolean", label: "boolean"},
];

function RowTagBindingModalContent({row, binding, onConfirm}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);

  // Модалка размонтируется/монтируется заново при каждом открытии (ModalRoot
  // рендерит content под key={openKey}), поэтому начальные значения useState
  // всегда актуальны — сбрасывать их эффектом не нужно.
  const [name, setName] = useState(binding?.name ?? "");
  const [valueType, setValueType] = useState(binding?.value_type || "number");

  const tagId = selectedDevice ?? binding?.tag_id ?? "";
  const canConfirm = Boolean(name.trim()) && Boolean(tagId);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({name: name.trim(), tag_id: tagId, property_type: "TAG", value_type: valueType});
    closeModal();
  };

  const inputClass = cn(
    "w-full rounded-xl border bg-white dark:bg-gray-900/80",
    "border-gray-300 dark:border-gray-700/80",
    "px-4 py-3 text-gray-900 dark:text-gray-100",
    "placeholder:text-gray-400 dark:placeholder:text-gray-600",
    "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
    "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
    "transition-all shadow-sm"
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Привязка тега к строке {row + 1}
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Название параметра и тег, значение которого будет отображаться/применяться в этой строке.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Название параметра
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Температура"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Тип значения
          </label>
          <Select.Root value={valueType} onValueChange={setValueType}>
            <Select.Trigger className={cn(selectTriggerClassName, inputClass)}>
              <Select.Value placeholder="Выберите тип значения" />
              <Select.Icon>
                <ChevronDown className={selectIconClassName} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={6} className={selectContentClassName}>
                <Select.Viewport className="p-1.5">
                  <Select.Group>
                    {valueTypeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Waypoints className="h-4 w-4 text-indigo-500" />
            Выберите тег в дереве устройств
          </div>

          <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/70">
            <DeviceTreePanel />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500">
            {tagId ? `Выбран тег: ${tagId}` : "Пока тег не выбран — кнопка сохранения будет недоступна."}
          </p>
        </div>
      </div>

      <div className="shrink-0 mt-6 pt-4 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-800/80">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-400 disabled:to-gray-400 text-white shadow-lg shadow-indigo-500/30 disabled:shadow-none transition-all"
        >
          {binding ? "Сохранить" : "Привязать"}
        </button>
      </div>
    </div>
  );
}

export default function openRowTagBindingModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<RowTagBindingModalContent {...props} />);
}
