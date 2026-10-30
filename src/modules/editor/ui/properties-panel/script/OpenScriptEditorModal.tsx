import {useModalStore} from "@/shared/ui/dialog/modalStore";
import React, {useId, useState, useEffect, useMemo} from "react";
import CodeMirror from '@uiw/react-codemirror';
import {javascript} from "@codemirror/lang-javascript";
import {Wand2} from "lucide-react";
import {formatCode} from "@/shared/lib/formatCode";
import {Button} from "@/shared/ui/Button";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import {fieldLabelClass} from "@/shared/ui/field/fieldStyles";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {checkScriptSyntax} from "@/core/runtime";
import {AccessLevelSelect} from "@/core/access";

interface ScriptModalProps {
  title: string;
  description: string;
  defaultName?: string;
  defaultContent?: string;
  /** Показывать ли скрипт пунктом меню в мониторе (ElementScript.displayed). */
  defaultDisplayed?: boolean;
  /** Уровень доступа скрипта в мониторе (ElementScript.accessLevel); null — уровень 1. */
  defaultAccessLevel?: number | null;
  confirmLabel?: string;
  onConfirm: (name: string, content: string, displayed: boolean, accessLevel: number | null) => void | Promise<void>;
}

export function ScriptEditorModalContent({
  title,
  description,
  defaultName = "",
  defaultContent = "",
  defaultDisplayed = false,
  defaultAccessLevel = null,
  confirmLabel = "Сохранить",
  onConfirm,
}: ScriptModalProps) {
  const closeModal = useCloseModal();
  const [name, setName] = useState(defaultName);
  const [content, setContent] = useState(defaultContent);
  const [displayed, setDisplayed] = useState(defaultDisplayed);
  const [accessLevel, setAccessLevel] = useState<number | null>(defaultAccessLevel);
  const [isLoading, setIsLoading] = useState(false);
  const accessLevelId = useId();

  useEffect(() => {
    setName(defaultName);
    setContent(defaultContent);
    setDisplayed(defaultDisplayed);
    setAccessLevel(defaultAccessLevel);
  }, [defaultName, defaultContent, defaultDisplayed, defaultAccessLevel]);

  // Бэкенд отклонит всю сцену со скриптом, который не разбирается (контракт 25.09.2026),
  // поэтому битый код не даём сохранить здесь — автор видит ошибку сразу, а не при
  // сохранении схемы одним сообщением на все её скрипты.
  const syntaxError = useMemo(() => checkScriptSyntax(content), [content]);

  const handleConfirmAction = async () => {
    if (!name?.trim() || !content?.trim() || syntaxError) return;

    setIsLoading(true);
    try {
      await onConfirm(name, content, displayed, accessLevel);
      closeModal();
    } catch (error) {
      console.error("Confirm error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <DialogHeader hint title={title} description={description} />

      <DialogBody className="flex flex-col gap-4">
        <Field label="Название скрипта" className="shrink-0">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, onClick, onInit..." />
        </Field>

        {/* Помеченный скрипт становится пунктом меню компонента в мониторе
            (ПКМ по компоненту) — оператор запускает его вручную, не дожидаясь
            события. Непомеченный по-прежнему вызывается только из обработчика
            события через runScript("Имя"). */}
        <div className="shrink-0">
          <Checkbox
            checked={displayed}
            onChange={(e) => setDisplayed(e.target.checked)}
            label={<>
              Добавить действие в монитор?
              <span className="text-xs text-muted-foreground">(пункт в меню компонента по правому клику)</span>
            </>}
          />
        </div>

        {/* Уровень оператора, которому монитор разрешит запуск (кнопка, пункт меню,
            runScript). Проверяет сервер по prod-выпуску, поэтому новый уровень начинает
            действовать только после выпуска и назначения его prod. */}
        <div className="shrink-0 flex items-center gap-2.5 text-sm">
          <label htmlFor={accessLevelId} className="font-medium">Уровень доступа</label>
          <AccessLevelSelect id={accessLevelId} value={accessLevel} onChange={setAccessLevel} />
          <span className="text-xs text-muted-foreground">
            (оператор с уровнем ниже не сможет запустить скрипт; действует после выпуска и prod)
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-1 ml-1">
            <span className={fieldLabelClass}>Код скрипта (JavaScript)</span>
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
              extensions={[javascript()]}
              onChange={(value) => setContent(value)}
              theme="dark"
            />
          </div>
          {syntaxError && (
            <div role="alert" className="mt-2 ml-1 text-sm text-red-600 dark:text-red-400">
              Синтаксическая ошибка: {syntaxError}
            </div>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={handleConfirmAction}
          disabled={!name.trim() || !content.trim() || Boolean(syntaxError) || isLoading}
          title={syntaxError ? "Исправьте синтаксическую ошибку в коде" : undefined}
        >
          {isLoading ? "Загрузка..." : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}

export function openScriptEditorModal(props: ScriptModalProps) {
  const {openModal} = useModalStore.getState();

  openModal(<ScriptEditorModalContent {...props} />, {size: "fullscreen", closeOnOverlay: false})
}
