import { DeviceParamsLayoutType } from "@/types/nodeTypes";
import { useModalStore } from "@/shared/ui/dialog/modalStore";
import { useState } from "react";
import {Button} from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {addParam} from "../../model/deviceActions";
import {useDeviceDictionaries} from "../../model/deviceDictionaries";
import {useDeviceTreeStore} from "../../model/deviceTreeStore";

interface Props {
  onLoadAction: (param: { id: number; value: string; parentKey: string }) => void;
  paramTypesList: DeviceParamsLayoutType[];
}

export function ChooseParamTypeContent({ onLoadAction, paramTypesList }: Props) {
  const closeModal = useCloseModal();
  const { selectedDevice } = useDeviceTreeStore.getState();

  // Состояния для селекта и инпута
  const [selectedValue, setSelectedValue] = useState<string>(paramTypesList[0].id);
  const [inputValue, setInputValue] = useState<string>("");

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
      <DialogHeader
        title="Создание параметра"
        description="Выберите тип параметра и введите значение."
      />

      <DialogBody className="space-y-5">
        <Field label="Тип параметра">
          <Select
            defaultValue={selectedValue}
            onValueChange={setSelectedValue}
            placeholder="Выберите тип..."
            options={paramTypesList.map((paramType) => ({value: paramType.id, label: paramType.name}))}
          />
        </Field>
        <Field label="Значение параметра">
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Введите текст..." />
        </Field>
      </DialogBody>

      {/* Кнопки внизу */}
      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!inputValue.trim()}>
          Выбрать
        </Button>
      </DialogFooter>
    </>
  )
}

export function openChooseParamTypeModal() {
  const {openModal} = useModalStore.getState();
  const { paramsTypes } = useDeviceDictionaries.getState();

  if (paramsTypes.length > 0) {
    openModal(<ChooseParamTypeContent onLoadAction={addParam} paramTypesList={paramsTypes} />, {size: "md", closeOnOverlay: false});
  }
}

