import { DeviceParamsLayoutType } from "@/types/nodeTypes";
import { useModalStore } from "@/store/modalStore";
import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { ChevronDown, Type } from "lucide-react"; // Добавил иконку Type для инпута
import SelectItem from "@/components/ui/SelectItem";
import {
  selectContentClassName,
  selectIconClassName,
  selectTriggerClassName,
} from "@/components/ui/selectStyles";
import { useDeviceStore } from "@/store/useDeviceStore";
import { Button, ModalFooter } from "@/components/ui/Button";

interface Props {
  onLoadAction: (param: { id: number; value: string; parentKey: string }) => void;
  paramTypesList: DeviceParamsLayoutType[];
}

export function ChooseParamTypeContent({ onLoadAction, paramTypesList }: Props) {
  const { closeModal } = useModalStore.getState();
  const { selectedDevice } = useDeviceStore.getState();

  // Состояния для селекта и инпута
  const [selectedValue, setSelectedValue] = useState<string>(paramTypesList[0].id);
  const [inputValue, setInputValue] = useState<string>("");
  const typeLabelId = useId();
  const valueId = useId();

  const handleConfirm = () => {
    if (!selectedDevice) return;
    if (!inputValue.trim()) return; // Проверка на пустую строку

    const newParam = {
      id: Number(selectedValue),
      value: inputValue,
      parentKey: selectedDevice,
    };

    onLoadAction(newParam);
    closeModal();
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Создание параметра
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Выберите тип параметра и введите значение.
      </Dialog.Description>

      <div className="space-y-5">
        {/* Выбор типа (Select) */}
        <div className="space-y-2">
          {/* Select у Radix — кнопка, поэтому подпись связывается через
              id + aria-labelledby, а не htmlFor. */}
          <label
            id={typeLabelId}
            className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider"
          >
            Тип параметра
          </label>
          <Select.Root
            defaultValue={selectedValue}
            onValueChange={setSelectedValue}
          >
            <Select.Trigger aria-labelledby={typeLabelId} className={selectTriggerClassName}>
              <Select.Value placeholder="Выберите тип..." />
              <Select.Icon>
                <ChevronDown className={selectIconClassName} />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content position="popper" sideOffset={6} className={selectContentClassName}>
                <Select.Viewport className="p-1.5">
                  <Select.Group>
                    {paramTypesList.map((paramType) => (
                      <SelectItem key={paramType.id} value={paramType.id}>
                        {paramType.name}
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
          <label
            htmlFor={valueId}
            className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider"
          >
            Значение параметра
          </label>
          <div className="relative">
            <input
              id={valueId}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введите текст..."
              className={cn(
                "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5",
                "text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-hidden",
                "hover:border-gray-400 dark:hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-sm"
              )}
            />
            <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Кнопки внизу */}
      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!inputValue.trim()}>
          Выбрать
        </Button>
      </ModalFooter>
    </>
  )
}

export function openChooseParamTypeModal() {
  const {openModal} = useModalStore.getState();
  const {addParam, paramsTypes} = useDeviceStore.getState();

  if (paramsTypes.length > 0) {
    openModal(<ChooseParamTypeContent onLoadAction={addParam} paramTypesList={paramsTypes} />);
  }
}

