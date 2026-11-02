import React, {useState} from "react";
import {AlertTriangle, Sparkles} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {Spinner} from "@/shared/ui/Spinner";
import {Collapsible} from "@/shared/ui/codeModalParts";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useScriptGenerate} from "../../api/assistant";
import type {AssistantScriptKind} from "../../types/assistant.types";
import {AssistantTaskField, isTaskValid} from "./AssistantTaskField";
import {useAssistantAccess} from "./useAssistantAccess";

/**
 * Черновик скрипта от помощника (`scripts/generate`) — свёрнутый блок над полем кода.
 *
 * Помощник только предлагает: код показываем для просмотра, в поле редактора он попадает по
 * кнопке «Вставить», а сохраняется обычной кнопкой окна — с обычной проверкой синтаксиса.
 * `kind` задаёт место, где открыт редактор: от него зависит доступный скрипту API.
 */
export function AssistantScriptDraft({kind, currentCode, onInsert}: {
  kind: AssistantScriptKind;
  currentCode: string;
  onInsert: (code: string) => void;
}) {
  const {projectId, available} = useAssistantAccess();
  const generate = useScriptGenerate(projectId);
  const [task, setTask] = useState("");

  if (!available) return null;

  const result = generate.data;

  const insert = async () => {
    if (!result) return;
    // Своё уже написанное заменяем только с согласия: черновик помощника не должен молча
    // стереть код, над которым человек работал.
    if (currentCode.trim() && currentCode !== result.code) {
      const ok = await confirmModal({
        title: "Заменить код черновиком помощника?",
        description: "Текущий код в поле будет заменён. Сохранится он только по кнопке окна.",
        confirmLabel: "Заменить",
      });
      if (!ok) return;
    }
    onInsert(result.code);
  };

  return (
    <Collapsible title={<span className="inline-flex items-center gap-1.5"><Sparkles size={12} />Помощник</span>}>
      <AssistantTaskField
        label="Что должен делать скрипт"
        value={task}
        onChange={setTask}
        placeholder="Например: взять args.value, ограничить от 0 до 100 и записать в свойство SP"
        disabled={generate.isPending}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => generate.mutate({kind, task: task.trim()})}
          disabled={!isTaskValid(task) || generate.isPending}
        >
          {generate.isPending ? <Spinner /> : <Sparkles size={14} />}
          {generate.isPending ? "Помощник думает…" : "Предложить"}
        </Button>
        {generate.isPending && (
          <span className="text-xs text-muted-foreground">Первый запрос после простоя — до 15 с</span>
        )}
      </div>

      {generate.error && (
        <Banner tone="warning" icon={AlertTriangle}>{generate.error.message}</Banner>
      )}

      {result && !generate.isPending && (
        <div className="space-y-2">
          <pre className="max-h-48 overflow-auto rounded-lg border bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap">
            {result.code}
          </pre>
          {result.issues.length > 0 && (
            <Banner tone="warning" icon={AlertTriangle} title="Замечания проверки">
              <ul className="list-disc pl-4 space-y-0.5">
                {result.issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </Banner>
          )}
          <p className="text-xs text-muted-foreground">
            Проверка статическая, скрипт не исполнялся. Код попадёт в поле редактора, сохранение — как обычно.
          </p>
          <Button size="sm" variant="primary" onClick={() => void insert()} disabled={!result.code.trim()}>
            Вставить в редактор
          </Button>
        </div>
      )}
    </Collapsible>
  );
}
