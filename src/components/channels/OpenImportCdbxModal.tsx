"use client";

import React, {useEffect, useId, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {FileUp, FolderPlus} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {pickFile} from "@/lib/pickFile";
import type {CdbxImportReport} from "@/types/cdbxImport.types";
import {openImportReportModal} from "@/components/channels/OpenImportReportModal";

const inputClass = cn(
  "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-3",
  "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-hidden",
  "hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all",
);

const labelClass = "text-xs font-medium text-gray-500 ml-1 uppercase tracking-wider";

/** Площадка и проект — имена узлов базы, точка в них разделяет уровни пути. */
const badSegment = (value: string) => !value.trim() || value.includes(".");

function ImportCdbxContent() {
  const closeModal = useModalStore((s) => s.closeModal);

  const [file, setFile] = useState<File | null>(null);
  const [site, setSite] = useState("");
  const [project, setProject] = useState("");
  const [sites, setSites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const siteId = useId();
  const projectId = useId();
  const sitesListId = useId();

  // Площадки — подсказкой, а не жёстким выбором: импорт вправе создать и новую.
  useEffect(() => {
    fetch("/api/device/site/")
      .then(res => (res.ok ? res.json() : []))
      .then((data: unknown) => setSites(Array.isArray(data) ? data.filter(s => typeof s === "string") : []))
      .catch(() => setSites([]));
  }, []);

  const handlePick = async () => {
    const picked = await pickFile(".cdbx");
    if (!picked) return;
    setFile(picked);
    // Имя проекта по умолчанию — из файла, но менять его инженер вправе: бэкенд из файла
    // ничего не берёт, путь базы задаётся здесь.
    if (!project.trim()) {
      const base = picked.name.replace(/\.cdbx$/i, "").replace(/\./g, "_").trim();
      if (base) setProject(base);
    }
  };

  const canSubmit = Boolean(file) && !badSegment(site) && !badSegment(project) && !isLoading;

  const handleSubmit = async () => {
    if (!file || !canSubmit) return;

    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("site", site.trim());
      form.append("project", project.trim());

      const res = await fetch("/api/device/import", {method: "POST", body: form});
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 409 «проект уже есть» и 400 «битый файл» — объяснимые отказы, текст бэкенда
        // точнее любого нашего: показываем его как есть.
        const message = (data as {message?: string} | null)?.message;
        throw new Error(message || `Не удалось импортировать файл (${res.status})`);
      }

      const report = data as CdbxImportReport;
      closeModal();

      // Новый проект не входит в загруженные, и сам по себе в дереве не появится —
      // подгружаем его рядом с уже открытыми, иначе инженеру пришлось бы искать его
      // через выбор проектов.
      const {loadedRootPath, loadNodes} = useDeviceStore.getState();
      await loadNodes([...(loadedRootPath ?? []), report.root]).catch(() => {});

      openImportReportModal(report);
    } catch (err) {
      console.error("Ошибка импорта .cdbx:", err);
      toast.error(err instanceof Error ? err.message : "Не удалось импортировать файл");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1">Импорт базы каналов</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Файл `.cdbx` старой системы станет новым проектом базы каналов. Площадку и имя проекта
        задаёте вы — из файла они не берутся. Существующие проекты импорт не трогает.
      </Dialog.Description>

      <div className="space-y-5">
        <div className="space-y-2">
          <span className={labelClass}>Файл</span>
          <button
            type="button"
            onClick={() => void handlePick()}
            className={cn(
              inputClass,
              "flex items-center gap-3 text-left",
              !file && "text-gray-500 dark:text-gray-400",
            )}
          >
            <FileUp className="h-5 w-5 shrink-0 text-indigo-500" />
            <span className="min-w-0 flex-1 truncate">
              {file ? file.name : "Выберите файл .cdbx"}
            </span>
            {file && (
              <span className="shrink-0 text-xs text-gray-500">
                {(file.size / (1024 * 1024)).toFixed(1)} МБ
              </span>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor={siteId} className={labelClass}>Площадка</label>
          <input
            id={siteId}
            list={sitesListId}
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Барановичи-1"
            className={inputClass}
          />
          <datalist id={sitesListId}>
            {sites.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div className="space-y-2">
          <label htmlFor={projectId} className={labelClass}>Проект</label>
          <input
            id={projectId}
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="BN1_MCA2"
            className={inputClass}
          />
        </div>

        {(site.includes(".") || project.includes(".")) && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Точка разделяет уровни пути в базе — в имени площадки и проекта её быть не может.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
          <FolderPlus size={16} />
          {isLoading ? "Импорт…" : "Импортировать"}
        </Button>
      </ModalFooter>
    </>
  );
}

export function openImportCdbxModal() {
  useModalStore.getState().openModal(<ImportCdbxContent />);
}
