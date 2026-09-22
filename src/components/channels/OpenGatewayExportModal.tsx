"use client";

import React, {useId, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Check, Copy, Download, FileDown} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {copyText, downloadText} from "@/lib/downloadText";
import {safeFileName} from "@/lib/downloadJson";

const inputClass = cn(
  "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3",
  "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 outline-hidden",
  "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all",
);

const labelClass = "text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider";

/**
 * Блок тегов проекта для `controllers.yaml` шлюза.
 *
 * Текст берётся с бэкенда готовым и НЕ переформатируется: в YAML от отступов зависит смысл.
 */
function GatewayExportContent({root}: {root: string}) {
  const closeModal = useModalStore((s) => s.closeModal);

  const projectName = root.split(".")[1] ?? root;
  const [controllerId, setControllerId] = useState(`ptusa-${projectName.toLowerCase()}`);
  const [endpoint, setEndpoint] = useState("pac://127.0.0.1:10000");
  const [yaml, setYaml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const controllerIdField = useId();
  const endpointField = useId();

  const handleBuild = async () => {
    if (!controllerId.trim() || !endpoint.trim()) return;
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        root,
        controllerId: controllerId.trim(),
        endpoint: endpoint.trim(),
      });
      const res = await fetch(`/api/device/export/gateway?${query}`);

      if (!res.ok) {
        // 404 — под этим корнем нет каналов с «Именем в ПЛК»: так отвечает старая база,
        // собранная не импортом. Текст бэкенда объясняет это точнее нашего.
        const body = await res.json().catch(() => null);
        const message = (body as {message?: string} | null)?.message;
        throw new Error(message || `Не удалось выгрузить теги (${res.status})`);
      }

      setYaml(await res.text());
    } catch (err) {
      console.error("Ошибка выгрузки для шлюза:", err);
      toast.error(err instanceof Error ? err.message : "Не удалось выгрузить теги");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!yaml) return;
    const ok = await copyText(yaml);
    if (!ok) {
      toast.error("Браузер не дал доступ к буферу обмена — выделите текст и скопируйте вручную");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">Выгрузка тегов для шлюза</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Блок контроллера для <b>{root}</b>. Вставьте его в <code>controllers.yaml</code> шлюза и
        пересоберите шлюз — без этого теги нового проекта приходить не будут.
      </Dialog.Description>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor={controllerIdField} className={labelClass}>Идентификатор контроллера</label>
            <input
              id={controllerIdField}
              value={controllerId}
              onChange={(e) => setControllerId(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={endpointField} className={labelClass}>Адрес</label>
            <input
              id={endpointField}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {yaml && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Блок для controllers.yaml</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Скопировано" : "Копировать"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadText(`${safeFileName(root, "gateway")}.yaml`, yaml)}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Download size={14} />
                  Скачать
                </button>
              </div>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-3 text-xs text-gray-800 dark:text-gray-200">
              {yaml}
            </pre>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button onClick={closeModal}>{yaml ? "Закрыть" : "Отмена"}</Button>
        <Button
          variant="primary"
          onClick={() => void handleBuild()}
          disabled={!controllerId.trim() || !endpoint.trim() || isLoading}
        >
          <FileDown size={16} />
          {isLoading ? "Готовлю…" : yaml ? "Пересобрать" : "Сформировать"}
        </Button>
      </ModalFooter>
    </>
  );
}

export function openGatewayExportModal(root: string) {
  useModalStore.getState().openModal(<GatewayExportContent root={root} />, {variant: "fullscreen"});
}
