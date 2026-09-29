"use client";

import React, {useCallback, useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {Loader2, Package, Rocket} from "lucide-react";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {fetchReleases} from "@/lib/editor/releasesApi";
import type {VersionSummary} from "@/types/editorVersion.types";

const PAGE = 30;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
};

interface Props {
  projectId: number;
  projectName: string;
}

/**
 * Выпуски проекта (контракт docs/contract/2026-09-29-project-release-contract.md).
 *
 * Редактор правит черновик; монитор и runtime работают по prod-выпуску. Здесь — выпустить
 * текущий черновик, увидеть список выпусков и назначить prod. Отката проекта к выпуску нет:
 * бэкенд его не поддерживает, а prod можно вернуть на любой прежний выпуск.
 */
function ReleasesContent({projectId, projectName}: Props) {
  const closeModal = useModalStore(s => s.closeModal);
  const prodVersionNo = useEditorStore(s => s.projectProdVersions[projectId] ?? null);
  const inOperation = useEditorStore(s => s.projectRuntimeFlags[projectId] ?? false);
  const loadProjectRuntimeFlag = useEditorStore(s => s.loadProjectRuntimeFlag);
  const releaseProject = useEditorStore(s => s.releaseProject);
  const makeProdRelease = useEditorStore(s => s.makeProdRelease);

  const [rows, setRows] = useState<VersionSummary[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (to?: string) => {
    try {
      const page = await fetchReleases(projectId, {to, limit: PAGE});
      setRows(prev => (to ? [...prev, ...page] : page));
      setExhausted(page.length < PAGE);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    void loadProjectRuntimeFlag(projectId);
  }, [load, loadProjectRuntimeFlag, projectId]);

  const handleRelease = async () => {
    setBusy(true);
    try {
      const release = await releaseProject(projectId, comment.trim());
      if (!release) return;
      setComment("");
      if (!release.unchanged) {
        setLoading(true);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMakeProd = async (versionNo: number) => {
    const ok = await confirmModal({
      title: `Сделать выпуск №${versionNo} prod?`,
      description: inOperation
        ? "Проект в эксплуатации: runtime переключится на этот выпуск сразу, открытые мониторы перечитают схемы."
        : "Проект не в эксплуатации: выпуск начнёт исполняться при вводе в эксплуатацию.",
      confirmLabel: "Сделать prod",
    });
    if (!ok) return;
    await makeProdRelease(projectId, versionNo);
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div>
        <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
          Выпуски проекта «{projectName}»
        </Dialog.Title>
        <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
          Редактор правит черновик, монитор показывает prod-выпуск. Правки попадут на мониторы
          после выпуска и назначения его prod.
        </Dialog.Description>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !busy) void handleRelease(); }}
          placeholder="Комментарий к выпуску (что изменилось)"
          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 outline-none"
        />
        <Button variant="primary" onClick={() => void handleRelease()} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
          Выпустить
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading && !rows.length && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" />Загрузка…</div>
        )}
        {!loading && !rows.length && !error && (
          <div className="px-3 py-4 text-sm text-gray-500">Выпусков ещё нет. Выпустите текущий черновик кнопкой выше.</div>
        )}
        {rows.map(r => {
          const isProd = r.version_no === prodVersionNo;
          return (
            <div key={r.version_no} className={cn("flex items-start gap-3 px-3 py-2.5 text-sm", isProd && "bg-emerald-500/5")}>
              <Package size={16} className={cn("mt-0.5 shrink-0", isProd ? "text-emerald-500" : "text-neutral-400")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">№{r.version_no}</span>
                  {isProd && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      prod{inOperation ? " · исполняется" : ""}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{formatDate(r.created_at)} · {r.user_name || "—"}</span>
                </div>
                {r.comment && <div className="mt-0.5 text-gray-700 dark:text-gray-300 break-words">{r.comment}</div>}
              </div>
              {!isProd && (
                <button
                  type="button"
                  onClick={() => void handleMakeProd(r.version_no)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                >
                  Сделать prod
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!exhausted && rows.length > 0 && (
        <button
          type="button"
          onClick={() => { setLoading(true); void load(rows[rows.length - 1].created_at); }}
          className="self-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Показать ещё
        </button>
      )}

      <ModalFooter>
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

export function openReleasesModal(projectId: number, projectName: string) {
  useModalStore.getState().openModal(<ReleasesContent projectId={projectId} projectName={projectName} />);
}
