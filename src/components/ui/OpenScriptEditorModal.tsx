import {useModalStore} from "@/store/modalStore";
import {cn} from "@/lib/utils";
import React, {useId, useState, useEffect} from "react";
import CodeMirror from '@uiw/react-codemirror';
import {java} from "@codemirror/lang-java";
import {Wand2} from "lucide-react";
import {formatCode} from "@/lib/formatCode";
import {TitleWithHint} from "./codeModalParts";

interface ScriptModalProps {
  title: string;
  description: string;
  defaultName?: string;
  defaultContent?: string;
  confirmLabel?: string;
  onConfirm: (name: string, content: string) => void | Promise<void>;
}

export function ScriptEditorModalContent({
  title,
  description,
  defaultName = "",
  defaultContent = "",
  confirmLabel = "Сохранить",
  onConfirm,
}: ScriptModalProps) {
  const closeModal = useModalStore((s) => s.closeModal);
  const [name, setName] = useState(defaultName);
  const [content, setContent] = useState(defaultContent);
  const [isLoading, setIsLoading] = useState(false);
  const inputId = useId();

  useEffect(() => {
    setName(defaultName);
    setContent(defaultContent);
  }, [defaultName, defaultContent]);

  const handleConfirmAction = async () => {
    if (!name?.trim() || !content?.trim()) return;

    setIsLoading(true);
    try {
      await onConfirm(name, content);
      closeModal();
    } catch (error) {
      console.error("Confirm error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <TitleWithHint title={title} description={description} />

      <div className="shrink-0">
        <label htmlFor={inputId} className="block text-xs font-medium text-gray-500 mb-1 ml-1 uppercase tracking-wider">
          Название скрипта
        </label>
        <input
          id={inputId}
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, onClick, onInit..."
          className={cn(
            "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-2.5",
            "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 outline-none",
            "hover:border-gray-400 dark:hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
            "transition-all shadow-sm"
          )}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 ml-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
            Код скрипта (Java)
          </label>
          <button
            type="button"
            onClick={() => setContent(c => formatCode(c))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="Автоматически расставить отступы"
          >
            <Wand2 size={13} />
            Форматировать
          </button>
        </div>
        <div className="flex-1 min-h-0 border border-gray-300 dark:border-gray-700/80 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/70">
          <CodeMirror
            value={content}
            height="100%"
            className="h-full text-sm"
            extensions={[java()]}
            onChange={(value) => setContent(value)}
            theme="dark"
          />
        </div>
      </div>

      <div className="shrink-0 flex gap-3 justify-end">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600
            transition-colors text-gray-800 dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirmAction}
          disabled={!name.trim() || !content.trim() || isLoading}
          className="px-6 py-2.5 rounded-lg font-medium
          bg-linear-to-r from-indigo-600 to-blue-600
          hover:from-indigo-500 hover:to-blue-500
          disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:text-gray-500
          text-white shadow-lg shadow-indigo-900/30 transition-all disabled:shadow-none"
        >
          {isLoading ? "Загрузка..." : confirmLabel}
        </button>
      </div>
    </div>
  )
}

export function openScriptEditorModal(props: ScriptModalProps) {
  const {openModal} = useModalStore.getState();

  openModal(<ScriptEditorModalContent {...props} />, {variant: "fullscreen"})
}
