import {useModalStore} from "@/store/modalStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {cn} from "@/lib/utils";
import {Type} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import {PaletteItemType} from "@/types/palette.types";

interface Props {
  onLoadAction: (paletteItem: Omit<PaletteItemType, "id">) => void;
  faceplate: DiagramElement[];
}

export function CreateFaceplateContent({onLoadAction, faceplate} : Props) {
  const { closeModal } = useModalStore.getState();
  const [name, setName] = useState('');
  const [type, setType] = useState('');

  const handleConfirm = () => {
    if (!name.trim() || !type.trim()) return;

    const newPaletteItem: Omit<PaletteItemType, 'id'> = {
      type: 'custom',
      name,
      category: type,
      defaultProps: {},
      template: faceplate
    };

    onLoadAction(newPaletteItem);
    closeModal();
  }
  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        Создание шаблона
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Введите название и категорию шаблона.
      </Dialog.Description>

      <div className="space-y-5">
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
          disabled={!name.trim() || !type.trim()}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
          text-gray-900 dark:text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          Выбрать
        </button>
      </div>
    </>
  )
}

export function OpenCreateFaceplateModal(faceplate: DiagramElement[]) {
  const {openModal} = useModalStore.getState();
  const {createPaletteItem} = usePaletteStore.getState();

  openModal(<CreateFaceplateContent onLoadAction={createPaletteItem} faceplate={faceplate} />)
}

