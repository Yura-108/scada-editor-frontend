"use client";

import React, {useState, useEffect, useMemo} from "react";
import { useEditorStore } from "@/modules/editor";
import { toast } from "sonner";
import { MoveRight } from "lucide-react";

import Modal from "@/shared/ui/dialog/Modal";
import { Button } from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/field/Select";

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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Переместить в группу"
      description="Выберите группу, в которую хотите переместить элемент"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!selectedGroupKey || groups.length === 0}>
            <MoveRight className="w-4 h-4" />
            Переместить
          </Button>
        </>
      }
    >
      <Field label="Целевая группа">
        <Select
          value={selectedGroupKey}
          onValueChange={setSelectedGroupKey}
          key={isOpen ? "open" : "closed"} // ← Важный фикс
        >
          <SelectTrigger>
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
              // Подпись, а не пункт: пункт со значением "" Radix запрещает и падает с ошибкой.
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Нет доступных групп для перемещения</div>
            )}
          </SelectContent>
        </Select>
      </Field>
    </Modal>
  );
};