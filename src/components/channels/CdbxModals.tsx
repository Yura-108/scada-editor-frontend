'use client';

import React, {useEffect, useId, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertCircle, AlertTriangle, Copy, Download, RefreshCw} from "lucide-react";
import {toast} from "sonner";
import {useModalStore} from "@/store/modalStore";
import {splitProjectKey, useDeviceStore} from "@/store/useDeviceStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {cn} from "@/lib/utils";
import {CdbxImportReport} from "@/types/channelsTypes";

const inputClass = cn(
  "w-full rounded-xl border bg-white dark:bg-gray-900",
  "border-gray-300 dark:border-gray-700",
  "text-gray-900 dark:text-gray-100",
  "placeholder:text-gray-500 dark:placeholder:text-gray-500",
  "hover:border-gray-400 dark:hover:border-gray-600",
  "focus:border-indigo-500 dark:focus:border-indigo-500",
  "focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30",
  "transition-all shadow-sm py-2.5 px-4",
);

const fileClass = cn(
  "block w-full text-sm text-gray-700 dark:text-gray-300",
  "file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:font-medium",
  "file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100",
  "dark:file:bg-indigo-950/60 dark:file:text-indigo-300",
);

const labelClass = "text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider";

function ErrorBox({message}: {message: string}) {
  return (
    <div className="mt-5 flex gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="h-5 w-5 shrink-0"/>
      <p className="break-words">{message}</p>
    </div>
  );
}

/** Площадка и проект становятся сегментами пути тега — точка в них запрещена. */
const nameProblem = (value: string) => {
  if (!value.trim()) return 'Обязательное поле';
  if (value.includes('.')) return 'Без точки — она разделяет уровни пути тега';
  return null;
};

// ─── Импорт ──────────────────────────────────────────────────────────────────

function ImportCdbxContent() {
  const {closeModal} = useModalStore.getState();
  const importCdbx = useDeviceStore((s) => s.importCdbx);

  const [file, setFile] = useState<File | null>(null);
  const [ioFile, setIoFile] = useState<File | null>(null);
  const [objectsFile, setObjectsFile] = useState<File | null>(null);
  const [site, setSite] = useState('');
  const [project, setProject] = useState('');
  const [sites, setSites] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CdbxImportReport | null>(null);

  const ids = {file: useId(), site: useId(), sites: useId(), project: useId(), io: useId(), objects: useId()};

  useEffect(() => {
    fetch('/api/device/site/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]));
  }, []);

  const siteProblem = site ? nameProblem(site) : null;
  const projectProblem = project ? nameProblem(project) : null;
  const canSubmit = !!file && !nameProblem(site) && !nameProblem(project) && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;

    const form = new FormData();
    form.append('file', file);
    form.append('site', site.trim());
    form.append('project', project.trim());
    // Исходники ПЛК необязательны и независимы — шлём только выбранные.
    if (ioFile) form.append('io', ioFile);
    if (objectsFile) form.append('objects', objectsFile);

    setIsSubmitting(true);
    setError(null);
    try {
      setReport(await importCdbx(form));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Не удалось импортировать .cdbx');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (report) return <ImportReport report={report} onClose={closeModal}/>;

  return (
    <form onSubmit={handleSubmit}>
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Импорт .cdbx
      </Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        База каналов из файла будет создана в новом проекте. Площадка и проект из файла не берутся.
      </Dialog.Description>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={ids.file} className={labelClass}>Файл .cdbx</label>
          <input
            id={ids.file}
            type="file"
            accept=".cdbx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={fileClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={ids.site} className={labelClass}>Площадка</label>
          <input
            id={ids.site}
            list={ids.sites}
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Например: Барановичи-1"
            className={inputClass}
          />
          <datalist id={ids.sites}>
            {sites.map((s) => <option key={s} value={s}/>)}
          </datalist>
          {siteProblem && <p className="ml-1 text-xs text-red-600 dark:text-red-400">{siteProblem}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor={ids.project} className={labelClass}>Новый проект</label>
          <input
            id={ids.project}
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Например: BN1_MCA2"
            className={inputClass}
          />
          {projectProblem && <p className="ml-1 text-xs text-red-600 dark:text-red-400">{projectProblem}</p>}
        </div>

        <details className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            Исходники проекта ПЛК (необязательно, но дерево получится точнее)
          </summary>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Эти файлы лежат в проекте ПЛК рядом с <code>main.plua</code>. Без них приборы раскладываются
            по общему правилу, а объекты получают имена вида <code>LINE1.OBJECT</code>.
          </p>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label htmlFor={ids.io} className={labelClass}>main.io.lua</label>
              <input id={ids.io} type="file" onChange={(e) => setIoFile(e.target.files?.[0] ?? null)} className={fileClass}/>
            </div>
            <div className="space-y-1">
              <label htmlFor={ids.objects} className={labelClass}>main.objects.lua</label>
              <input id={ids.objects} type="file" onChange={(e) => setObjectsFile(e.target.files?.[0] ?? null)} className={fileClass}/>
            </div>
          </div>
        </details>
      </div>

      {error && <ErrorBox message={error}/>}

      <ModalFooter>
        <Button onClick={closeModal} disabled={isSubmitting}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin"/>}
          {isSubmitting ? 'Импорт…' : 'Импортировать'}
        </Button>
      </ModalFooter>
    </form>
  );
}

function NameList({names}: {names: string[]}) {
  return (
    <ul className="mt-2 max-h-40 overflow-y-auto custom-scrollbar rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
      {names.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}

function ReportSection({summary, names}: {summary: string; names: string[]}) {
  return (
    <details className="text-sm text-gray-700 dark:text-gray-300">
      <summary className="cursor-pointer">{summary}</summary>
      <NameList names={names}/>
    </details>
  );
}

function ImportReport({report, onClose}: {report: CdbxImportReport; onClose: () => void}) {
  const {merged = [], guessedType = [], skipped = [], unmapped = []} = report;

  return (
    <>
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Импорт завершён
      </Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Создан проект <b>{report.root}</b>: {report.channels} каналов.
      </Dialog.Description>

      <div className="space-y-3">
        {merged.length > 0 && (
          <ReportSection
            summary={`${merged.length} каналов объединены — одна переменная ПЛК была в двух группах`}
            names={merged}
          />
        )}
        {guessedType.length > 0 && (
          <ReportSection
            summary={`У ${guessedType.length} каналов тип данных угадан (FLOAT) — проверьте параметр «Тип данных»`}
            names={guessedType}
          />
        )}
        {skipped.length > 0 && (
          <p className="text-sm text-gray-700 dark:text-gray-300">Пропущены: {skipped.join(', ')}</p>
        )}
        {unmapped.length > 3 ? (
          // Длинный список — признак, что исходники ПЛК от другой ревизии проекта.
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="flex gap-2 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0"/>
              {unmapped.length} объектов не нашлось в исходниках ПЛК и разложены по общему правилу.
              Возможно, файлы ПЛК от другой ревизии проекта.
            </p>
            <NameList names={unmapped}/>
          </div>
        ) : unmapped.length > 0 && (
          <ReportSection
            summary={`${unmapped.length} объектов не нашлось в исходниках ПЛК и разложены по общему правилу`}
            names={unmapped}
          />
        )}
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={onClose}>Готово</Button>
      </ModalFooter>
    </>
  );
}

export function OpenImportCdbxModal() {
  useModalStore.getState().openModal(<ImportCdbxContent/>);
}

// ─── Выгрузка для шлюза ──────────────────────────────────────────────────────

function GatewayExportContent({projectKey}: {projectKey: string}) {
  const {closeModal} = useModalStore.getState();
  const exportGateway = useDeviceStore((s) => s.exportGateway);
  const {project} = splitProjectKey(projectKey);

  const [controllerId, setControllerId] = useState(`ptusa-${project.toLowerCase()}`);
  const [endpoint, setEndpoint] = useState('pac://127.0.0.1:10000');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yaml, setYaml] = useState<string | null>(null);
  const ids = {controller: useId(), endpoint: useId()};

  const canSubmit = !!controllerId.trim() && !!endpoint.trim() && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    try {
      setYaml(await exportGateway({root: projectKey, controllerId: controllerId.trim(), endpoint: endpoint.trim()}));
    } catch (err) {
      setYaml(null);
      setError(err instanceof Error && err.message ? err.message : 'Не удалось выгрузить теги');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!yaml) return;
    try {
      await navigator.clipboard.writeText(yaml);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать — выделите текст вручную');
    }
  };

  const handleDownload = () => {
    if (!yaml) return;
    const url = URL.createObjectURL(new Blob([yaml], {type: 'text/yaml;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `controllers-${project}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
        Выгрузка для шлюза
      </Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Теги проекта <b>{projectKey}</b> блоком для <code>controllers.yaml</code>.
      </Dialog.Description>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={ids.controller} className={labelClass}>ID контроллера</label>
          <input id={ids.controller} value={controllerId} onChange={(e) => setControllerId(e.target.value)} className={inputClass}/>
        </div>
        <div className="space-y-2">
          <label htmlFor={ids.endpoint} className={labelClass}>Адрес (endpoint)</label>
          <input id={ids.endpoint} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className={inputClass}/>
        </div>
      </div>

      {error && <ErrorBox message={error}/>}

      {yaml && (
        <div className="mt-5 space-y-2">
          <textarea
            readOnly
            value={yaml}
            aria-label="Блок для controllers.yaml"
            className="h-64 w-full resize-y rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Вставьте блок в controllers.yaml шлюза и пересоберите его — без этого теги нового проекта не будут приходить.
          </p>
        </div>
      )}

      <ModalFooter>
        <Button onClick={closeModal}>Закрыть</Button>
        {yaml && (
          <>
            <Button onClick={handleCopy}><Copy className="h-4 w-4"/>Копировать</Button>
            <Button onClick={handleDownload}><Download className="h-4 w-4"/>Скачать</Button>
          </>
        )}
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin"/>}
          {yaml ? 'Обновить' : 'Сформировать'}
        </Button>
      </ModalFooter>
    </form>
  );
}

export function OpenGatewayExportModal(projectKey: string) {
  useModalStore.getState().openModal(<GatewayExportContent projectKey={projectKey}/>);
}
