"use client";

import React, {useState} from "react";
import {GitBranch, Loader2, RefreshCw, ShieldCheck, Users} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {BranchesTab, resyncAccess, UsersTab} from "@/modules/admin";

type Tab = "users" | "branches";

/**
 * Администрирование (только админ): пользователи, их права в проектах, ветки каталога
 * проектов и перепубликация прав. Регистрации нет — пользователей заводит администратор.
 */
export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("users");
  const [resyncing, setResyncing] = useState(false);

  const handleResync = async () => {
    setResyncing(true);
    try {
      await resyncAccess();
      toast.success("Права перепубликованы на сервисах");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
        <ShieldCheck size={16} className="text-indigo-500" />
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Администрирование</span>
        {([["users", "Пользователи", Users], ["branches", "Ветки каталога", GitBranch]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm",
              tab === key ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          onClick={() => void handleResync()}
          disabled={resyncing}
          title="Перепубликовать права из базы auth на все сервисы — если права где-то не применились"
        >
          {resyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Обновить права на сервисах
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === "users" ? <UsersTab /> : <BranchesTab />}
      </div>
    </div>
  );
}
