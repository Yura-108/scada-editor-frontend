"use client";

import React, {useEffect, useState} from "react";
import {Save} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {useOpenScene} from "@/core/project";
import {fetchBranches, putBranches} from "../api/adminApi";
import {inputClass} from "./adminStyles";

/** Ветки каталога проекта: какие узлы базы каналов видят и правят его пользователи. */
export function BranchesTab() {
  const projectList = useOpenScene(s => s.projectList);
  const loadProjectList = useOpenScene(s => s.loadProjectList);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    setLoading(true);
    fetchBranches(projectId)
      .then(list => {
        if (cancelled) return;
        const joined = list.join("\n");
        setText(joined);
        setSavedText(joined);
      })
      .catch(err => !cancelled && toast.error((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectId]);

  const save = async () => {
    if (projectId == null) return;
    const branches = text.split("\n").map(s => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      await putBranches(projectId, branches);
      const joined = [...new Set(branches)].join("\n");
      setText(joined);
      setSavedText(joined);
      toast.success("Ветки каталога сохранены");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <p className="text-sm text-neutral-500">
        Ветки определяют, какие узлы базы каналов видят и правят пользователи проекта: «правка» в проекте —
        правка узлов под ветками, «просмотр» — чтение. Без веток каталог для них пуст. Удалять корень ветки
        и узлы выше может только администратор.
      </p>
      <select className={inputClass} value={projectId ?? ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}>
        <option value="" disabled>Проект…</option>
        {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {projectId != null && (
        loading ? <p className="text-sm text-neutral-500">Загрузка…</p> : (
          <>
            <textarea
              className={cn(inputClass, "w-full h-48 font-mono")}
              placeholder={"По одной ветке в строке, например:\nБарановичи-1.BN1_MCA1"}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button variant="primary" disabled={saving || text === savedText} onClick={() => void save()}>
                <Save size={14} />{saving ? "Сохранение…" : "Сохранить ветки"}
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
