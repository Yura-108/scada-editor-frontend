import { useModalStore } from "@/store/modalStore";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { ChevronDown, Type } from "lucide-react";
import SelectItem from "@/components/ui/SelectItem";
import { useDeviceStore } from "@/store/useDeviceStore";

interface Props {
  onLoadAction: (node: {
    type: number;
    idNode: string;
    parentKey: string;
  }) => Promise<void>;
  templateList: {key: number; value: string}[];
  nodeKey: string;
}

export function CreateDeviceContent({ onLoadAction, templateList, nodeKey }: Props) {
  const { closeModal } = useModalStore.getState();

  const [selectedValue, setSelectedValue] = useState<string>(String(templateList[0].key));
  const [inputValue, setInputValue] = useState<string>("");

  const handleConfirm = () => {
    if (!inputValue.trim()) return;

    const newDevice = {
      type: Number(selectedValue),
      idNode: inputValue,
      parentKey: nodeKey,
    }

    void onLoadAction(newDevice);
    closeModal();
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Создание устройства
      </Dialog.Title>

      <Dialog.Description className="text-gray-400 mb-6 text-sm">
        Выберите тип устройства и введите его имя.
      </Dialog.Description>

      <div className="space-y-5">
        {/* Выбор типа (Select) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Тип устройства
          </label>
          <Select.Root
            defaultValue={String(templateList[0].key)}
            onValueChange={setSelectedValue}
          >
            <Select.Trigger
              className={cn(
                "flex w-full items-center justify-between rounded-xl border border-gray-700/80",
                "bg-gray-900/60 px-4 py-3.5 text-left text-gray-100",
                "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-sm outline-hidden"
              )}
            >
              <Select.Value placeholder="Выберите тип..." />
              <Select.Icon>
                <ChevronDown className="h-5 w-5 opacity-70" />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                className={cn(
                  "z-100 min-w-(--radix-select-trigger-width) max-h-64 overflow-hidden",
                  "rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/60",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out"
                )}
              >
                <Select.Viewport className="p-1.5">
                  <Select.Group>
                    {templateList.map((template) => (
                      <SelectItem key={template.key} value={String(template.key)}>
                        {template.value}
                      </SelectItem>
                    ))}
                  </Select.Group>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Поле ввода значения (Input) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Название устройства
          </label>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введите текст..."
              className={cn(
                "w-full rounded-xl border border-gray-700/80 bg-gray-900/60 px-4 py-3.5",
                "text-gray-100 placeholder:text-gray-600 outline-hidden",
                "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-sm"
              )}
            />
            <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Кнопки внизу */}
      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-800
          hover:bg-gray-700 border border-gray-700 hover:border-gray-600
            transition-colors text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!inputValue.trim()}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
          text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          Создать
        </button>
      </div>
    </>
  )
}

export function OpenCreateDeviveModal(nodeKey: string) {
  const {openModal} = useModalStore.getState();
  const {addDevice, deviceTemplateList} = useDeviceStore.getState();

  if (deviceTemplateList.templates.length > 0) {
    openModal(<CreateDeviceContent onLoadAction={addDevice} templateList={deviceTemplateList.templates} nodeKey={nodeKey} />);
  }
}