"use client";

import {useMemo} from "react";
import {Plus} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import {createUuid} from "@/shared/lib/createUuid";
import {openScriptEditorModal} from "@/components/ui/OpenScriptEditorModal";
import {useEditorStore} from "../../../model/editorStore";
import {baseAddButtonClasses} from "../panelClasses";
import {EmptyState} from "@/shared/ui/EmptyState";

// Скрипты компонента исполняются НА СЕРВЕРЕ — это JavaScript в GraalJS
// (script-core бэкенда), а не Java, как долго писали в подписях: монитор только
// шлёт ACTION с их id (см. runScript в useRuntimeEngine). Обработчики событий и
// привязки — тоже JavaScript, но в браузере.
const SCRIPT_DESCRIPTION = "JavaScript-код, который выполнится на сервере. Вызывается из обработчика события через runScript(\"Имя\", аргументы?) или пунктом showMenu. Аргументы клика — объект args ({} без аргументов); проверяйте их диапазон в скрипте.";

/** Вкладка «Скрипты»: серверные скрипты элемента. */
export function ScriptsTab({element}: {element: DiagramElement}) {
  const updateElement = useEditorStore(s => s.updateElement);
  const elementScripts = useMemo(() => element.scripts ?? [], [element.scripts]);

  const handleAddScript = () => {
    openScriptEditorModal({
      title: "Добавление скрипта",
      description: SCRIPT_DESCRIPTION,
      onConfirm: (name, content, displayed, accessLevel) => {
        const newScript = { id: createUuid(), name, content, displayed, accessLevel };
        updateElement(element.key, {
          scripts: [...(element.scripts || []), newScript]
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Добавленные скрипты
      </h4>

      {elementScripts.length === 0 ? (
        <EmptyState size="sm" title="Нет добавленных скриптов" className="py-3" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {elementScripts.map(script => (
            <button
              key={script.id}
              type="button"
              title={`Редактировать скрипт «${script.name}»`
                + (script.displayed ? " (показывается в меню монитора)" : "")
                + (script.accessLevel ? `, уровень доступа ${script.accessLevel}` : "")}
              className={`
                inline-flex items-center px-2.5 py-1.5
                text-xs font-medium rounded-full
                bg-blue-950/60 text-blue-300
                border border-blue-800/40
                hover:bg-blue-900/70 transition-colors cursor-pointer
              `}
              onClick={() => {
                  openScriptEditorModal({
                    title: "Редактирование скрипта",
                    description: SCRIPT_DESCRIPTION,
                    defaultName: script.name,
                    defaultContent: script.content,
                    defaultDisplayed: script.displayed,
                    defaultAccessLevel: script.accessLevel ?? null,
                    onConfirm: (name, content, displayed, accessLevel) => {
                      const updatedScripts = elementScripts.map(s =>
                        s.id === script.id ? { ...s, name, content, displayed, accessLevel } : s
                      );
                      updateElement(element.key, { scripts: updatedScripts });
                    }
                  });
              }}
            >
              {/* Точка = скрипт выведен пунктом в меню монитора: иначе
                  отличить его от обычного можно только открыв модалку. */}
              {script.displayed && (
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
              {script.name}
              {script.accessLevel != null && (
                <span className="ml-1.5 rounded bg-blue-800/60 px-1 text-[10px]">ур. {script.accessLevel}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        className={baseAddButtonClasses}
        onClick={handleAddScript}
      >
        <Plus size={18}/>
        Добавить скрипт
      </button>
    </div>
  );
}
