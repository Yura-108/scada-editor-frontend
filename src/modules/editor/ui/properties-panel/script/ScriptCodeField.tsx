import React, {type Dispatch, type RefObject, type SetStateAction} from "react";
import CodeMirror, {EditorView} from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Wand2} from "lucide-react";
import {formatCode} from "@/shared/lib/formatCode";

/** Поле кода редактора скрипта: подпись, «Форматировать» и CodeMirror на всю оставшуюся высоту. */
export function ScriptCodeField({code, setCode, viewRef}: {
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  /** Сюда кладётся `EditorView` — через него чипы вставляют текст в позицию курсора. */
  viewRef: RefObject<EditorView | null>;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-1 ml-1">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
          Код (JavaScript)
        </label>
        <button
          type="button"
          onClick={() => setCode(c => formatCode(c))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          title="Автоматически расставить отступы"
        >
          <Wand2 size={13} />
          Форматировать
        </button>
      </div>
      <div className="flex-1 min-h-0 border border-gray-300 dark:border-gray-700/80 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/70">
        <CodeMirror
          value={code}
          height="100%"
          className="h-full text-sm"
          extensions={[javascript()]}
          onChange={value => setCode(value)}
          onCreateEditor={view => { viewRef.current = view; }}
          theme="dark"
        />
      </div>
    </div>
  );
}
