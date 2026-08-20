"use client";

import React, {useState, useEffect, useMemo} from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { MoveRight } from "lucide-react";

import Modal from "@/components/ui/Modal";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface MoveToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  elementKey: string | null;
}

export const MoveToGroupModal = ({
                                   isOpen,
                                   onClose,
                                   elementKey,
                                 }: MoveToGroupModalProps) => {
  // Точечные селекторы: подписка на весь стор перерисовывала модалку на каждый
  // тик пана/зума — она смонтирована в Canvas постоянно.
  const elements = useEditorStore(s => s.elements);
  const moveElementToGroup = useEditorStore(s => s.moveElementToGroup);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");

  const groups = useMemo(
    () => elements.filter((el) => el.type === "group" && el.key !== elementKey),
    [elements, elementKey]
  );

  // Сброс/установка значения при каждом открытии модалки (не при изменении списка групп).
  useEffect(() => {
    if (isOpen && groups.length > 0) {
      setSelectedGroupKey(groups[0].key);
    } else {
      setSelectedGroupKey("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleConfirm = () => {
    if (!selectedGroupKey) {
      toast.error("Пожалуйста, выберите группу");
      return;
    }

    moveElementToGroup(elementKey!, selectedGroupKey);
    toast.success("Элемент успешно перемещён");
    onClose();
  };

  if (!isOpen || !elementKey) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Переместить в группу">
      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Выберите группу, в которую хотите переместить элемент
        </p>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Целевая группа
          </label>

          <Select
            value={selectedGroupKey}
            onValueChange={setSelectedGroupKey}
            key={isOpen ? "open" : "closed"} // ← Важный фикс
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Выберите группу..." />
            </SelectTrigger>

            <SelectContent>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <SelectItem key={group.key} value={group.key}>
                    <div className="flex items-center gap-3 py-2 ">
                      <span className="text-lg">📁</span>
                      <div>
                        <div className="font-medium">
                          {group.label || `Группа ${group.key.slice(0, 8)}`}
                        </div>

                      </div>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  Нет доступных групп для перемещения
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
          >
            Отмена
          </button>

          <button
            onClick={handleConfirm}
            disabled={!selectedGroupKey || groups.length === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-xl transition-all flex items-center gap-2"
          >
            <MoveRight className="w-4 h-4" />
            Переместить
          </button>
        </div>
      </div>
    </Modal>
  );
};