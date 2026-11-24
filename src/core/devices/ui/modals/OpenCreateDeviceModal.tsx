import { useModalStore } from "@/shared/ui/dialog/modalStore";
import { toast } from "sonner";
import { useState } from "react";
import {Button} from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {addDevice} from "../../model/deviceActions";
import {getDeviceTemplates} from "../../model/deviceDictionaries";

/**
 * Шаблоны узлов приходят кодами (`dev`, `sub`, `cha`…). В списке — словом, код в скобках:
 * по нему шаблон узнаёт тот, кто привык к старой системе (#16 п. 8). Незнакомый код — как есть.
 */
const TEMPLATE_NAMES: Record<string, string> = {
  dev: "Устройство",
  sub: "Подустройство",
  cha: "Канал",
};
const templateLabel = (code: string) => {
  const name = TEMPLATE_NAMES[code.trim().toLowerCase()];
  return name ? `${name} (${code})` : code;
};

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
  const closeModal = useCloseModal();

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
      <DialogHeader
        // То же название, что у пункта меню, — раньше меню звало «Добавить узел», а окно «Создание устройства».
        title="Добавить узел"
        description="Выберите тип узла и введите его имя — оно станет последней частью пути."
      />

      <DialogBody className="space-y-5">
        <Field label="Тип узла">
          <Select
            defaultValue={String(templateList[0].key)}
            onValueChange={setSelectedValue}
            placeholder="Выберите тип…"
            options={templateList.map((template) => ({value: String(template.key), label: templateLabel(template.value)}))}
          />
        </Field>
        <Field label="Имя узла">
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Например, TANK5" />
        </Field>
      </DialogBody>

      {/* Кнопки */}
      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!inputValue.trim()}>
          Добавить
        </Button>
      </DialogFooter>
    </>
  )
}

export function OpenCreateDeviveModal(nodeKey: string) {
  const {openModal} = useModalStore.getState();
  const deviceTemplateList = getDeviceTemplates();

  const templates = deviceTemplateList?.templates ?? [];

  // Раньше при пустом списке пункт «Добавить» молча ничего не делал — теперь
  // объясняем причину вместо тишины.
  if (templates.length === 0) {
    toast.error('Список шаблонов устройств пуст — не удалось загрузить его с сервера');
    return;
  }

  openModal(<CreateDeviceContent onLoadAction={addDevice} templateList={templates} nodeKey={nodeKey} />, {size: "md", closeOnOverlay: false});
}

