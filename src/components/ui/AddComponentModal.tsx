"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useEditorStore } from "@/modules/editor";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import Modal from "@/shared/ui/dialog/Modal";
import { Button } from "@/shared/ui/Button";
import { elementRegistry } from "@/constants/propertiesPanel";
import { getDescendants } from "@/lib/getDescendants";
import { DiagramElement, ElementType } from "@/types/editorElement.type";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";

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
  // Точечные селекторы — см. тот же комментарий в MoveToGroupModal.
  const elements = useEditorStore(s => s.elements);
  const moveElementToGroup = useEditorStore(s => s.moveElementToGroup);
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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Добавить компонент"
      description="Выберите компонент, который нужно вложить в текущий"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!selectedKey || candidates.length === 0}>
            <Plus className="w-4 h-4" />
            Добавить
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-semibold">
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

          <SelectContent>
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
    </Modal>
  );
};
