import React, {useState} from "react";
import {AlertTriangle, Search, Sparkles} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {Badge} from "@/shared/ui/Badge";
import {Spinner} from "@/shared/ui/Spinner";
import {Collapsible} from "@/shared/ui/codeModalParts";
import {useTagResolve} from "../../api/assistant";
import {useChannelRoot} from "../project/useChannelRoot";
import {ChannelRootPicker} from "../project/ChannelRootPicker";
import {AssistantTaskField, isTaskValid} from "./AssistantTaskField";
import {useAssistantAccess} from "./useAssistantAccess";

/**
 * Подбор тега свойства по описанию (`tags/resolve`).
 *
 * Предложение помощника существует в каталоге, но может быть не тем каналом, поэтому сами
 * его не подставляем: показываем кандидатов, тег выбирает человек — кликом, как в дереве.
 */
export function AssistantTagResolve({value, onPick}: {value: string | null; onPick: (path: string) => void}) {
  const {projectId, available} = useAssistantAccess();
  const channelRoot = useChannelRoot();
  const resolve = useTagResolve(projectId);
  const [text, setText] = useState("");

  if (!available) return null;

  const result = resolve.data;
  const canFind = Boolean(channelRoot.root) && isTaskValid(text) && !resolve.isPending;

  return (
    <Collapsible title={<span className="inline-flex items-center gap-1.5"><Sparkles size={12} />Подобрать по описанию</span>}>
      <ChannelRootPicker state={channelRoot} />
      <AssistantTaskField
        label="Какой канал нужен"
        value={text}
        onChange={setText}
        placeholder="Например: клапан 12 четвёртого танка, состояние"
        disabled={resolve.isPending}
      />
      <Button
        size="sm"
        onClick={() => resolve.mutate({channel_root: channelRoot.root, text: text.trim()})}
        disabled={!canFind}
        title={channelRoot.root ? undefined : "Выберите базу каналов"}
      >
        {resolve.isPending ? <Spinner /> : <Search size={14} />}
        {resolve.isPending ? "Ищу…" : "Найти"}
      </Button>

      {resolve.error && <Banner tone="warning" icon={AlertTriangle}>{resolve.error.message}</Banner>}

      {result && !resolve.isPending && (
        result.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Подходящих каналов не нашлось — уточните описание.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Выберите канал — помощник может ошибиться, проверьте путь.
            </p>
            {result.candidates.map(c => (
              <button
                key={c.path}
                type="button"
                onClick={() => onPick(c.path)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm",
                  value === c.path ? "bg-primary/15 text-primary" : "hover:bg-accent",
                )}
              >
                <span className="font-mono break-all">{c.path}</span>
                {c.path === result.path && <Badge tone="info" className="ml-2">предложение помощника</Badge>}
                {c.description && <span className="ml-2 text-xs text-muted-foreground">{c.description}</span>}
              </button>
            ))}
          </div>
        )
      )}
    </Collapsible>
  );
}
