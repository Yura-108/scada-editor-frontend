import { useModalStore } from "@/store/modalStore";
import { toast } from "sonner";
import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { ChevronDown, Type } from "lucide-react";
import SelectItem from "@/components/ui/SelectItem";
import {
  selectContentClassName,
  selectIconClassName,
  selectTriggerClassName,
} from "@/components/ui/selectStyles";
import { useDeviceStore } from "@/store/useDeviceStore";
import { Button, ModalFooter } from "@/components/ui/Button";

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
  const typeLabelId = useId();
  const nameId = useId();

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
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Создание устройства
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Выберите тип устройства и введите его имя.
      </Dialog.Description>

      <div className="space-y-5">
        {/* Выбор типа (Select).
            Radix Select.Trigger — кнопка, а не поле формы: `htmlFor` её не
            подписывает, поэтому связь идёт через id + aria-labelledby. */}
        <div className="space-y-2">
          <label
            id={typeLabelId}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider"
          >
            Тип устройства
          </label>
          <Select.Root
            defaultValue={String(templateList[0].key)}
            onValueChange={setSelectedValue}
          >
            <Select.Trigger aria-labelledby={typeLabelId} className={selectTriggerClassName}>
              <Select.Value placeholder="Выберите тип..." />
              <Select.Icon>
                <ChevronDown className={selectIconClassName} />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                className={selectContentClassName}
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

        {/* Поле ввода */}
        <div className="space-y-2">
          <label
            htmlFor={nameId}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider"
          >
            Название устройства
          </label>
          <div className="relative">
            <input
              id={nameId}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введите текст..."
              className={cn(
                "w-full rounded-xl border bg-white dark:bg-gray-900",
                "border-gray-300 dark:border-gray-700",
                "text-gray-900 dark:text-gray-100",
                "placeholder:text-gray-500 dark:placeholder:text-gray-500",
                "hover:border-gray-400 dark:hover:border-gray-600",
                "focus:border-indigo-500 dark:focus:border-indigo-500",
                "focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30",
                "transition-all shadow-sm py-3.5 px-4"
              )}
            />
            <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Кнопки */}
      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!inputValue.trim()}>
          Создать
        </Button>
      </ModalFooter>
    </>
  )
}

export function OpenCreateDeviveModal(nodeKey: string) {
  const {openModal} = useModalStore.getState();
  const {addDevice, deviceTemplateList} = useDeviceStore.getState();

  const templates = deviceTemplateList?.templates ?? [];

  // Раньше при пустом списке пункт «Добавить» молча ничего не делал — теперь
  // объясняем причину вместо тишины.
  if (templates.length === 0) {
    toast.error('Список шаблонов устройств пуст — не удалось загрузить его с сервера');
    return;
  }

  openModal(<CreateDeviceContent onLoadAction={addDevice} templateList={templates} nodeKey={nodeKey} />);
}

