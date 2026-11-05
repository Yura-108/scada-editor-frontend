import {useEffect} from "react";
import {useSessionUserStore} from "@/core/access";
import {useDeviceTreeStore} from "./deviceTreeStore";
import {loadParamTypes} from "./deviceDictionaries";
import {readLoadedProjects} from "./loadedProjectsMemory";

/** Восстановление пробуем один раз за загрузку страницы: пикеров на экране бывает несколько. */
let restoreTried = false;

/**
 * После F5 снова грузит проекты, загруженные в этой вкладке (`loadedProjectsMemory`), —
 * как кнопка «Загрузить». Висит на пикере проектов: он есть и в «Базе каналов», и в пустом
 * дереве «Автоматизации» и окна выбора тега, так что дерево возвращается везде.
 *
 * Ждёт логин: его кладёт `SessionUserBootstrap` эффектом layout, а эффект пикера срабатывает
 * раньше. Ошибка загрузки — обычная плашка дерева с «Повторить» (её ставит `loadNodes`).
 */
export function useRestoreLoadedProjects() {
  const login = useSessionUserStore(s => s.login);

  useEffect(() => {
    if (!login || restoreTried) return;
    restoreTried = true;

    const {loadedRootPath, isLoadingNodes, loadNodes} = useDeviceTreeStore.getState();
    if (loadedRootPath?.length || isLoadingNodes) return;
    const saved = readLoadedProjects(login);
    if (!saved) return;

    void loadNodes(saved)
      .then(() => loadParamTypes())
      .catch(() => { /* ошибку уже показал loadNodes */ });
  }, [login]);
}
