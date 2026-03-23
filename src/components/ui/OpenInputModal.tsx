import {useModalStore} from "@/store/modalStore";
import * as Dialog from "@radix-ui/react-dialog";
import {cn} from "@/lib/utils";
import {Type} from "lucide-react";
import React, {useId, useState} from "react";

interface InputModalProps {
  title: string;
  description: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
}

export function InputModalContent({
  title,
  description,
  label = "Введите значение",
  placeholder = "Введите текст...",
  defaultValue = "",
  confirmLabel = "Добавить",
  onConfirm,
}: InputModalProps) {
  const closeModal = useModalStore((s) => s.closeModal);
  const [value, setValue] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const inputId = useId();

  const handleConfirmAction = async () => {
    if (!value?.trim()) return;

    setIsLoading(true);
    try {
      await onConfirm(value);
      closeModal();
    } catch (error) {
      console.error("Confirm error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">
        {title}
      </Dialog.Title>

      <Dialog.Description className="text-gray-400 mb-6 text-sm">
        {description}
      </Dialog.Description>

      <div className="space-y-5">
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider">
            {label}
          </label>
          <div className="relative">
            <input
              id={inputId}
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
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
          onClick={handleConfirmAction}
          disabled={!value.trim() || isLoading}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
          text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          {isLoading ? "Загрузка..." : confirmLabel}
        </button>
      </div>
    </>
  )
}

export function openInputModal(props: InputModalProps) {
  const {openModal} = useModalStore.getState();

  openModal(<InputModalContent {...props} />)
}



