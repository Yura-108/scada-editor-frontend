import {DeviceParamsLayoutType} from "@/types/nodeTypes";
import {useModalStore} from "@/store/modalStore";
import {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {cn} from "@/lib/utils";
import {ChevronDown} from "lucide-react";
import SelectItem from "@/components/ui/SelectItem";
import {useDeviceStore} from "@/store/useDeviceStore";

interface Props {
  onLoadAction: (param: {id: number, value: string, parentKey: string}) => void;
  paramTypesList: DeviceParamsLayoutType[];
}

export function ChooseParamTypeContent({onLoadAction, paramTypesList}: Props) {
  const {closeModal} = useModalStore.getState();
  const {selectedDevice} = useDeviceStore.getState();
  const [selectedValue, setSelectedValue] = useState<string>(paramTypesList[0].id);
  const value = 'str';

  const handleConfirm = () => {
    if (!selectedDevice) return;
    if (!value) return;

    const newParam = {
      id: Number(selectedValue),
      value,
      parentKey: selectedDevice
    }

    onLoadAction(newParam);
    closeModal();
  }

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Выберите схему для загрузки
      </Dialog.Title>

      <Dialog.Description className="text-gray-400 mb-6 text-sm">
        Загрузите одну из сохранённых сцен.
      </Dialog.Description>

      <Select.Root
        defaultValue={paramTypesList[0].id}
        onValueChange={setSelectedValue}
      >
        <Select.Trigger
          className={cn(
            "flex w-full items-center justify-between rounded-xl border border-gray-700/80",
            "bg-gray-900/60 px-4 py-3.5 text-left text-gray-100",
            "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
            "transition-all shadow-sm"
          )}
        >
          <Select.Value placeholder="Выберите сцену..." />
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
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
          >
            <Select.ScrollUpButton className="flex h-8 items-center justify-center bg-gray-900/80 text-gray-400">
              <ChevronDown className="h-5 w-5 rotate-180" />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1.5">
              <Select.Group>
                {paramTypesList.map((paramType) => (
                  <SelectItem key={paramType.id} value={paramType.id}>
                    {paramType.name}
                  </SelectItem>
                ))}
              </Select.Group>
            </Select.Viewport>

            <Select.ScrollDownButton className="flex h-8 items-center justify-center bg-gray-900/80 text-gray-400">
              <ChevronDown className="h-5 w-5" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {/* Кнопки внизу */}
      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-800
          hover:bg-gray-700 border border-gray-700 hover:border-gray-600
            transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          text-white shadow-lg shadow-indigo-900/30 transition-all"
        >
          Выбрать
        </button>
      </div>
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