"use client";

import {PaletteItemType} from "@/types/palette.types";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useEditorStore} from "@/store/useEditorStore";
import {ElementType} from "@/types/editorElement.type";
import {Trash2} from "lucide-react";
import {confirmModal} from "@/components/ui/ConfirmModal";

const STATIC_ID_THRESHOLD = 10 ** 5;

interface PaletteItemProps {
  item: PaletteItemType;
}

export default function PaletteItem({item}: PaletteItemProps) {
  const deletePaletteItem = usePaletteStore(s => s.deletePaletteItem);
  const isStatic = item.id >= STATIC_ID_THRESHOLD;

  // «Вооружение» инструмента: клик по элементу палитры сохраняет его в pendingPlacement,
  // следующий клик по холсту ставит элемент (см. Canvas.handleStagePlacementClick).
  const armed = useEditorStore((s) => s.pendingPlacement?.id === item.id);

  const toggleArm = () => {
    const {pendingPlacement, setPendingPlacement} = useEditorStore.getState();
    setPendingPlacement(
      pendingPlacement?.id === item.id
        ? null
        : {id: item.id, type: item.type as ElementType, template: item.template},
    );
  };

  return (
    <div className="group relative flex items-center gap-1">
      {/* Настоящая кнопка, а не div: элемент палитры «вооружается» кликом, и это
          состояние (aria-pressed) должно быть слышно скринридеру, а сам элемент —
          достижим с клавиатуры. */}
      <button
        type="button"
        onClick={toggleArm}
        aria-pressed={armed}
        title={armed ? `${item.name} — выбран, кликните по холсту` : item.name}
        className={`flex-1 min-w-0 text-left bg-gray-100 hover:bg-gray-200 dark:bg-[#1b1b1b] dark:hover:bg-[#262626]
                 text-gray-900 dark:text-gray-100 px-3 py-2 rounded cursor-pointer
                 flex items-center transition-colors${
                   armed ? " ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-500/10" : ""
                 }`}
      >
        <span className="text-sm truncate">{item.name}</span>
      </button>

      {!isStatic && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={async () => {
            // Серверное удаление, undo его не откатит — спрашиваем подтверждение.
            const confirmed = await confirmModal({
              title: `Удалить шаблон «${item.name}»?`,
              description: "Шаблон будет удалён из палитры безвозвратно.",
              confirmLabel: "Удалить",
              danger: true,
            });
            if (confirmed) void deletePaletteItem(item.id);
          }}
          className="p-1.5 rounded text-neutral-400 hover:text-red-500
                   hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100
                   focus-visible:opacity-100 transition-all duration-200"
          title="Удалить шаблон"
          aria-label={`Удалить шаблон «${item.name}»`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}