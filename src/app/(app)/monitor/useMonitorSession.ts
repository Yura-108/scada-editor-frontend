import {useEffect, useRef} from "react";
import {toast} from "sonner";
import type {RuntimeStatus} from "@/modules/monitor";
import {useEditorStore, useSceneCameraMemory, restoreLastProject} from "@/modules/editor";
import {lastMonitorScene, rememberMonitorScene} from "@/core/project";

/**
 * Монитор поверх общего с редактором стора: источник «выпуск» и пауза отмены на время жизни
 * страницы, восстановление проекта и последней схемы, флаги эксплуатации. Живёт в `app`, а не
 * в модуле монитора: ему нужен стор редактора, а модули друг друга не импортируют.
 */
export function useMonitorSession() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const sceneList = useEditorStore(s => s.sceneList);
  const scene = useEditorStore(s => s.scene);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const loadSceneList = useEditorStore(s => s.loadSceneList);
  const loadScene = useEditorStore(s => s.loadScene);
  const loadProjectRuntimeFlag = useEditorStore(s => s.loadProjectRuntimeFlag);

  // Своя память вида: пан оператора не должен сбивать камеру в редакторе.
  useSceneCameraMemory("monitor");

  // Монитор не редактирует, но стор общий с редактором: страхуемся от случайных
  // записей в историю undo на время жизни страницы.
  useEffect(() => {
    // Монитор рисует prod-выпуск, не черновик редактора (контракт
    // 2026-09-29-project-release-contract.md). Первым делом, до загрузки списка схем ниже:
    // стор откладывает документ редактора и дальше читает схемы из выпуска.
    useEditorStore.getState().setSceneSource("release");
    const temporal = useEditorStore.temporal.getState();
    temporal.pause();
    useEditorStore.getState().clearSelection();
    // Уровень (activeGroupKey) общий с редактором: в монитор нужно входить с корня
    // сцены, а выходя — не оставлять редактору чужой открытый компонент.
    useEditorStore.setState({activeGroupKey: null});
    return () => {
      // Рантайм-карты чистит cleanup движка (clearRuntime).
      useEditorStore.setState({activeGroupKey: null});
      // Возврат к черновику: стор кладёт на место документ редактора как был.
      useEditorStore.getState().setSceneSource("draft");
      useEditorStore.temporal.getState().resume();
    };
  }, []);

  // Проект и схему монитор помнит: оператор возвращается к тому же экрану после перезагрузки
  // и после похода в другие разделы, а не выбирает их каждый раз заново.
  useEffect(() => {
    void loadProjectList().then(projects => { if (projects) restoreLastProject(projects); });
  }, [loadProjectList]);

  useEffect(() => {
    if (currentProject) void loadSceneList(currentProject.id);
  }, [currentProject, loadSceneList]);

  // Последняя схема — один раз на проект, когда список схем выпуска уже есть, а схема не открыта.
  // Схемы, которой нет в выпуске, не открываем: её удалили или не выпустили.
  const restoredSceneFor = useRef<number | null>(null);
  useEffect(() => {
    if (!currentProject || scene || sceneList.length === 0) return;
    if (restoredSceneFor.current === currentProject.id) return;
    restoredSceneFor.current = currentProject.id;
    const last = lastMonitorScene(currentProject.id);
    if (last != null && sceneList.some(s => s.id === last)) void loadScene(last);
  }, [currentProject, scene, sceneList, loadScene]);

  const openSceneId = scene?.id != null ? Number(scene.id) : null;
  useEffect(() => {
    if (currentProject && openSceneId != null && Number.isSafeInteger(openSceneId)) {
      rememberMonitorScene(currentProject.id, openSceneId);
    }
  }, [currentProject, openSceneId]);

  // Флаг эксплуатации приходит отдельным эндпоинтом. Без него выключенный проект в списке
  // неотличим от рабочего, и оператор узнавал бы о причине, только не дождавшись данных.
  useEffect(() => {
    for (const p of projectList) void loadProjectRuntimeFlag(p.id);
  }, [projectList, loadProjectRuntimeFlag]);
}

/**
 * 4403: права отозваны (или учётка отключена). Переподключаться бессмысленно — уводим к
 * выбору проекта и перечитываем список: отозванный проект из него пропадёт.
 */
export function useMonitorRevoked(status: RuntimeStatus) {
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);
  const loadProjectList = useEditorStore(s => s.loadProjectList);

  useEffect(() => {
    if (status !== "revoked") return;
    const name = useEditorStore.getState().currentProject?.name;
    toast.error(name ? `Доступ к проекту «${name}» отозван` : "Доступ к проекту отозван");
    setCurrentProject(null);
    void loadProjectList();
  }, [status, setCurrentProject, loadProjectList]);
}
