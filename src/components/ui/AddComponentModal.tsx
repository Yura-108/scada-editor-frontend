"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import Modal from "@/components/ui/Modal";
import { elementRegistry } from "@/constants/propertiesPanel";
import { getDescendants } from "@/lib/getDescendants";
import { DiagramElement, ElementType } from "@/types/editorElement.type";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Компонент, В который добавляем другой компонент. */
  targetKey: string | null;
}

const isComponentEl = (el: DiagramElement) =>
  el.isComponent === true || (elementRegistry[el.type as ElementType]?.complex ?? false);

export const AddComponentModal = ({
  isOpen,
  onClose,
  targetKey,
}: AddComponentModalProps) => {
  const { elements, moveElementToGroup } = useEditorStore();
  const [selectedKey, setSelectedKey] = useState<string>("");

  // Кандидаты: компоненты сцены, кроме самого целевого и его потомков
  // (нельзя вложить контейнер в самого себя / в своего ребёнка).
  const candidates = useMemo(() => {
    if (!targetKey) return [];
    const forbidden = new Set<string>([targetKey]);
    getDescendants(targetKey, elements).forEach(d => forbidden.add(d.key));
    return elements.filter(el => isComponentEl(el) && !forbidden.has(el.key));
  }, [elements, targetKey]);

  useEffect(() => {
    if (isOpen && candidates.length > 0) {
      setSelectedKey(candidates[0].key);
    } else {
      setSelectedKey("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleConfirm = () => {
    if (!selectedKey || !targetKey) {
      toast.error("Пожалуйста, выберите компонент");
      return;
    }
    moveElementToGroup(selectedKey, targetKey);
    toast.success("Компонент добавлен");
    onClose();
  };

  if (!isOpen || !targetKey) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Добавить компонент">
      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Выберите компонент, который нужно вложить в текущий
        </p>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Компонент
          </label>

          <Select
            value={selectedKey}
            onValueChange={setSelectedKey}
            key={isOpen ? "open" : "closed"}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Выберите компонент..." />
            </SelectTrigger>

            <SelectContent className="bg-neutral-800">
              {candidates.length > 0 ? (
                candidates.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    <div className="flex items-center gap-3 py-2">
                      <span className="text-lg">🧩</span>
                      <div className="font-medium">
                        {c.label || `Компонент ${c.key.slice(0, 8)}`}
                      </div>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  Нет доступных компонентов
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
          >
            Отмена
          </button>

          <button
            onClick={handleConfirm}
            disabled={!selectedKey || candidates.length === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
};
