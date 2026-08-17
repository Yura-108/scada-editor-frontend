import {useModalStore} from "@/store/modalStore";
import * as Dialog from "@radix-ui/react-dialog";
import {cn} from "@/lib/utils";
import {Type} from "lucide-react";
import React, {useId, useState} from "react";
import { Button, ModalFooter } from "@/components/ui/Button";

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

      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
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
                "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3.5",
                "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-hidden",
                "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-sm"
              )}
            />
            <Type className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600 pointer-events-none" />
          </div>
      </div>

      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={handleConfirmAction} disabled={!value.trim() || isLoading}>
          {isLoading ? "Загрузка..." : confirmLabel}
        </Button>
      </ModalFooter>
    </>
  )
}

export function openInputModal(props: InputModalProps) {
  const {openModal} = useModalStore.getState();

  openModal(<InputModalContent {...props} />)
}





