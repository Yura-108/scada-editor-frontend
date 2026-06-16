import {useModalStore} from "@/store/modalStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {cn} from "@/lib/utils";
import {Type, ChevronDown} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import {PaletteItemType} from "@/types/palette.types";
import SelectItem from "./SelectItem";

interface Props {
  onLoadAction: (paletteItem: Omit<PaletteItemType, "id">) => void;
  onUpdateAction?: (id: number, paletteItem: Omit<PaletteItemType, "id">) => void;
  faceplate: DiagramElement[];
}

export function CreateFaceplateContent({onLoadAction, onUpdateAction, faceplate} : Props) {
  const { closeModal } = useModalStore.getState();
  const { paletteItems } = usePaletteStore.getState();

  // Фильтруем только пользовательские шаблоны (custom)
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
    } else {
      // Режим обновления
      if (onUpdateAction && selectedTemplateId) {
        onUpdateAction(Number(selectedTemplateId), newPaletteItem);
      }
    }
    closeModal();
  }
  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Создание и обновление шаблонов
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Создайте новый шаблон или обновите существующий.
      </Dialog.Description>

      {/* Режим выбора */}
      <div className="space-y-4 mb-6 pb-6 border-b border-gray-300 dark:border-gray-700">
        <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
          Режим
        </label>
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
                ? "bg-indigo-600 text-white shadow-lg"
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
                ? "bg-indigo-600 text-white shadow-lg"
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
        {/* Select существующих шаблонов для обновления */}
        {mode === 'update' && customTemplates.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Выберите шаблон для обновления
            </label>
            <Select.Root value={selectedTemplateId} onValueChange={handleSelectTemplate}>
              <Select.Trigger
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border border-gray-300 dark:border-gray-700/80",
                  "bg-white dark:bg-gray-900/60 px-4 py-3.5 text-left text-gray-100",
                  "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                  "transition-all shadow-sm"
                )}
              >
                <Select.Value placeholder="Выберите шаблон..." />
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
                    "rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-black/60",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                  )}
                >
                  <Select.ScrollUpButton className="flex h-8 items-center justify-center bg-white dark:bg-gray-900/80 text-gray-600 dark:text-gray-400">
                    <ChevronDown className="h-5 w-5 rotate-180" />
                  </Select.ScrollUpButton>

                  <Select.Viewport className="p-1.5">
                    <Select.Group>
                      {customTemplates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name} ({template.category})
                        </SelectItem>
                      ))}
                    </Select.Group>
                  </Select.Viewport>

                  <Select.ScrollDownButton className="flex h-8 items-center justify-center bg-white dark:bg-gray-900/80 text-gray-600 dark:text-gray-400">
                    <ChevronDown className="h-5 w-5" />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        )}

        {/* Название шаблона */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            Название шаблона
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите текст..."
              className={cn(
                "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5",
                "text-gray-100 placeholder:text-gray-600 outline-hidden",
                "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-sm"
              )}
            />
            <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
          </div>
        </div>

        {/* Категория шаблона - только для режима создания */}
        {mode === 'create' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
              Категория шаблона
            </label>
            <div className="relative">
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Введите текст..."
                className={cn(
                  "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5",
                  "text-gray-100 placeholder:text-gray-600 outline-hidden",
                  "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                  "transition-all shadow-sm"
                )}
              />
              <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
            </div>
          </div>
         )}
       </div>

       {/* Кнопки внизу */}
      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800
          hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-600
            transition-colors text-gray-700 dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={
            !name.trim() ||
            (mode === 'create' && !type.trim()) ||
            (mode === 'update' && !selectedTemplateId)
          }
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
          text-gray-900 dark:text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          {mode === 'create' ? 'Создать' : 'Обновить'}
         </button>
       </div>
     </>
   );
}

export function OpenCreateFaceplateModal(faceplate: DiagramElement[]) {
  const {openModal} = useModalStore.getState();
  const {createPaletteItem, updatePaletteItem} = usePaletteStore.getState();

  openModal(<CreateFaceplateContent 
    onLoadAction={createPaletteItem} 
    onUpdateAction={updatePaletteItem}
    faceplate={faceplate} 
  />)
}

