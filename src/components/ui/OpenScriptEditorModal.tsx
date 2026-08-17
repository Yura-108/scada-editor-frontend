import {useModalStore} from "@/store/modalStore";
import {cn} from "@/lib/utils";
import React, {useId, useState, useEffect} from "react";
import CodeMirror from '@uiw/react-codemirror';
import {java} from "@codemirror/lang-java";
import {Wand2} from "lucide-react";
import {formatCode} from "@/lib/formatCode";
import {TitleWithHint} from "./codeModalParts";
import { Button, ModalFooter } from "@/components/ui/Button";

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

      <ModalFooter className="shrink-0 mt-0">
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={handleConfirmAction}
          disabled={!name.trim() || !content.trim() || isLoading}
        >
          {isLoading ? "Загрузка..." : confirmLabel}
        </Button>
      </ModalFooter>
    </div>
  )
}

export function openScriptEditorModal(props: ScriptModalProps) {
  const {openModal} = useModalStore.getState();

  openModal(<ScriptEditorModalContent {...props} />, {variant: "fullscreen"})
}
