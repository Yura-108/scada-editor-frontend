import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import {
  AutomationSaveError, fetchAutomation, saveAutomation, type AutomationSet, type AutomationValidationError,
} from "@/core/automation";
import {offerReload} from "./offerReload";

/**
 * Переменные проекта. Они едут в наборе automation (`…/automation`) вместе с задачами и
 * watchdog, поэтому документ — весь набор: загрузка, правка переменных (и `writes_variables`
 * задач), сохранение всего набора с разбором ошибок проверки и 409.
 */
export function useVariablesDocument(projectId: number | null) {
  const [automation, setAutomation] = useState<AutomationSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);

  // Документ прежнего проекта сбрасывается при смене проекта во время рендера, а не в эффекте
  // (`set-state-in-effect`): эффект только загружает.
  const [loadedFor, setLoadedFor] = useState(projectId);
  if (loadedFor !== projectId) {
    setLoadedFor(projectId);
    setAutomation(null);
  }

  const load = useCallback(
    () => projectId == null ? Promise.resolve() : fetchAutomation(projectId).then(
      (doc: AutomationSet) => {
        setAutomation(doc);
        setDirty(false);
        setErrors([]);
      },
      err => { toast.error((err as Error).message); },
    ),
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** «Перечитать с сервера»: документ пропадает (спиннер), пока не придёт заново. */
  const reload = useCallback(async () => {
    setAutomation(null);
    await load();
  }, [load]);

  const edit = (variables: AutomationSet["variables"], tasks: AutomationSet["tasks"]) => {
    setAutomation(a => (a ? {...a, variables, tasks} : a));
    setDirty(true);
  };

  /** `true` — сохранилось. */
  const save = async (): Promise<boolean> => {
    if (!automation || projectId == null) return false;
    try {
      // Задачи и watchdog уходят как пришли (плюс writes_variables, правленные здесь): PUT — весь набор.
      const saved = await saveAutomation(projectId, {
        based_on_version: automation.version,
        tasks: automation.tasks,
        variables: automation.variables,
        watchdog: automation.watchdog,
      });
      setAutomation(saved);
      setDirty(false);
      setErrors([]);
      toast.success(`Переменные сохранены, версия набора ${saved.version}`);
      return true;
    } catch (err) {
      if (err instanceof AutomationSaveError && err.errors.length) {
        setErrors(err.errors);
        toast.error(`Набор не прошёл проверку: ${err.errors.length}`);
      } else if (err instanceof AutomationSaveError && err.conflict) {
        toast.error(err.message);
        await offerReload("Набор автоматизации", reload);
      } else {
        toast.error((err as Error).message);
      }
      return false;
    }
  };

  return {automation, dirty, errors, reload, edit, save};
}
