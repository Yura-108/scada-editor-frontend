import { useModalStore } from "@/store/modalStore";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Type } from "lucide-react";
import { useDeviceStore } from "@/store/useDeviceStore";

interface Props {
  title: string;
  description: string;
  placeholder: string;
  onConfirm: (name: string) => void | Promise<void>;
}

// Упрощённая модалка «только название» — для создания площадки и проекта
// (в отличие от CreateDeviceContent тут нет выбора типа/шаблона).
export function CreateNamedNodeContent({ title, description, placeholder, onConfirm }: Props) {
  const { closeModal } = useModalStore.getState();

  const [inputValue, setInputValue] = useState<string>("");

  const handleConfirm = () => {
    if (!inputValue.trim()) return;

    void onConfirm(inputValue.trim());
    closeModal();
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        {title}
      </Dialog.Title>

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        {description}
      </Dialog.Description>

      <div className="space-y-5">
        {/* Поле ввода */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Название
          </label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              placeholder={placeholder}
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
      <div className="mt-8 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          border border-gray-300 dark:border-gray-700
          hover:border-gray-400 dark:hover:border-gray-600
          text-gray-700 dark:text-gray-300
          transition-colors"
        >
          Отмена
        </button>

        <button
          onClick={handleConfirm}
          disabled={!inputValue.trim()}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-300 disabled:to-gray-400
          disabled:text-gray-500 dark:disabled:from-gray-700 dark:disabled:to-gray-600
          text-white shadow-lg shadow-indigo-500/30
          transition-all disabled:shadow-none disabled:cursor-not-allowed"
        >
          Создать
        </button>
      </div>
    </>
  );
}

// Площадка — узел верхнего уровня (без родителя).
export function OpenCreateSiteModal() {
  const { openModal } = useModalStore.getState();
  const { addDevice } = useDeviceStore.getState();

  openModal(
    <CreateNamedNodeContent
      title="Создание площадки"
      description="Введите название новой площадки."
      placeholder="Название площадки"
      onConfirm={(name) => addDevice({ type: 0, idNode: name, parentKey: "" })}
    />
  );
}

// Проект — узел под площадкой (parentKey — ключ площадки).
export function OpenCreateProjectModal(parentKey: string) {
  const { openModal } = useModalStore.getState();
  const { addDevice } = useDeviceStore.getState();

  openModal(
    <CreateNamedNodeContent
      title="Создание проекта"
      description="Введите название нового проекта."
      placeholder="Название проекта"
      onConfirm={(name) => addDevice({ type: 0, idNode: name, parentKey })}
    />
  );
}
