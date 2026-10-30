import { useModalStore } from "@/shared/ui/dialog/modalStore";
import { usePaletteStore } from "@/store/usePaletteStore";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { DiagramElement } from "@/types/editorElement.type";
import { PaletteItemType } from "@/types/palette.types";
import {Button} from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {fieldLabelClass} from "@/shared/ui/field/fieldStyles";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";

interface Props {
  onLoadAction: (paletteItem: Omit<PaletteItemType, "id">) => void;
  onUpdateAction?: (id: number, paletteItem: Omit<PaletteItemType, "id">) => void;
  faceplate: DiagramElement[];
}

export function CreateFaceplateContent({ onLoadAction, onUpdateAction, faceplate }: Props) {
  const closeModal = useCloseModal();
  const { paletteItems } = usePaletteStore.getState();

  const customTemplates = paletteItems.filter(item => item.type === 'custom');

  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const selected = customTemplates.find(t => String(t.id) === templateId);
    if (selected) {
      setName(selected.name);
      setType(selected.category);
    }
  };

  const handleConfirm = () => {
    if (!name.trim()) return;
    if (mode === 'create' && !type.trim()) return;
    if (mode === 'update' && !selectedTemplateId) return;

    const newPaletteItem: Omit<PaletteItemType, 'id'> = {
      type: 'custom',
      name,
      category: mode === 'create' ? type : (customTemplates.find(t => String(t.id) === selectedTemplateId)?.category || type),
      defaultProps: {},
      template: faceplate
    };

    if (mode === 'create') {
      onLoadAction(newPaletteItem);
    } else if (onUpdateAction && selectedTemplateId) {
      onUpdateAction(Number(selectedTemplateId), newPaletteItem);
    }

    closeModal();
  };

  return (
    <>
      <DialogHeader
        title="Создание и обновление шаблонов"
        description="Создайте новый шаблон или обновите существующий."
      />

      <DialogBody>
        {/* Режим выбора */}
        <div className="space-y-4 mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
          <span className={fieldLabelClass}>Режим</span>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setMode('create');
                setSelectedTemplateId('');
                setName('');
                setType('');
              }}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg font-medium transition-all",
                mode === 'create'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              )}
            >
              Создать новый
            </button>

            <button
              onClick={() => {
                setMode('update');
                setName('');
                setType('');
              }}
              disabled={customTemplates.length === 0}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg font-medium transition-all",
                mode === 'update' && customTemplates.length > 0
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : customTemplates.length === 0
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              )}
            >
              Обновить существующий
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {mode === 'update' && customTemplates.length > 0 && (
            <Field label="Шаблон для обновления">
              <Select
                value={selectedTemplateId}
                onValueChange={handleSelectTemplate}
                placeholder="Выберите шаблон..."
                options={customTemplates.map((template) => ({
                  value: String(template.id),
                  label: `${template.name} (${template.category})`,
                }))}
              />
            </Field>
          )}

          <Field label="Название шаблона">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Введите название..." />
          </Field>

          {/* Категория — только при создании */}
          {mode === 'create' && (
            <Field label="Категория шаблона">
              <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Введите категорию..." />
            </Field>
          )}
        </div>
      </DialogBody>

      {/* Кнопки */}
      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={
            !name.trim() ||
            (mode === 'create' && !type.trim()) ||
            (mode === 'update' && !selectedTemplateId)
          }
        >
          {mode === 'create' ? 'Создать' : 'Обновить'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function OpenCreateFaceplateModal(faceplate: DiagramElement[]) {
  const { openModal } = useModalStore.getState();
  const { createPaletteItem, updatePaletteItem } = usePaletteStore.getState();

  openModal(
    <CreateFaceplateContent
      onLoadAction={createPaletteItem}
      onUpdateAction={updatePaletteItem}
      faceplate={faceplate}
    />,
    {size: "lg", closeOnOverlay: false},
  );
}