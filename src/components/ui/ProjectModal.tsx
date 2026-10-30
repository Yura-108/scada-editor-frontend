"use client";

import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {cn} from "@/shared/lib/cn";
import {Gauge, Link2, Power, PowerOff, Rocket, X} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {Badge} from "@/shared/ui/Badge";
import {useState, useEffect, useMemo} from "react";
import {useEditorStore, type EditorProject, openReleasesModal, openProcedureLevelsModal, selectProjectGuarded} from "@/modules/editor";
import {openChooseSceneModal} from "@/components/ui/OpenChooseSceneModal";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {openAutobindModal} from "@/components/ui/OpenAutobindModal";
import {Button} from "@/shared/ui/Button";
import {Input} from "@/shared/ui/field/Input";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {canOpenInEditor, grantOf, useSessionUserStore} from "@/core/access";

async function selectProjectAndOpenScenes(
  projectId: number,
  projectName: string,
  opts?: {skipSceneFetch?: boolean},
) {
  // Несохранённые правки — с вопросом; уже открытый проект не сбрасывается, а сразу
  // ведёт к выбору схемы. Новый проект пуст: пустой список предложит создать первую схему.
  if (!await selectProjectGuarded({id: projectId, name: projectName}, opts)) return;
  useModalStore.getState().closeModal();
  openChooseSceneModal();
}

export function ProjectContent() {
  const closeModal = useCloseModal();
  const allProjects = useEditorStore(state => state.projectList);
  const admin = useSessionUserStore(state => state.admin);
  // С одним «управлением» проект в редакторе не открывается (бэкенд ответит 403) — не
  // показываем его вовсе. Список стора остаётся полным: он же кормит монитор.
  // useMemo: от списка зависят эффекты ниже, новый массив на каждый рендер их зациклил бы.
  const projectList = useMemo(
    () => allProjects.filter(p => canOpenInEditor(grantOf(p, admin))),
    [allProjects, admin],
  );
  const loadProjectList = useEditorStore(state => state.loadProjectList);
  const createProject = useEditorStore(state => state.createProject);
  const deleteProject = useEditorStore(state => state.deleteProject);
  const runtimeFlags = useEditorStore(state => state.projectRuntimeFlags);
  const prodVersions = useEditorStore(state => state.projectProdVersions);
  const loadProjectRuntimeFlag = useEditorStore(state => state.loadProjectRuntimeFlag);
  const setProjectInOperation = useEditorStore(state => state.setProjectInOperation);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  // Флаг эксплуатации приходит отдельным эндпоинтом на каждый проект: в списке проектов
  // бэкенд его не отдаёт. Список короткий, поэтому спрашиваем по одному.
  useEffect(() => {
    for (const proj of projectList) void loadProjectRuntimeFlag(proj.id);
  }, [projectList, loadProjectRuntimeFlag]);

  const handleToggleOperation = async (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    const next = !runtimeFlags[proj.id];
    if (!next) {
      // Вывод из эксплуатации гасит проект целиком: останавливаются серверные скрипты и
      // идущие процедуры (мойка прервётся на текущем шаге).
      const ok = await confirmModal({
        title: `Вывести «${proj.name}» из эксплуатации?`,
        description: "Рантайм остановит проект: прекратятся обработчики изменений и идущие "
          + "процедуры, мониторы этого проекта отключатся.",
        confirmLabel: "Вывести",
        danger: true,
      });
      if (!ok) return;
    }
    await setProjectInOperation(proj.id, next);
  };

  // Состояния занятости строке не заводим: автопривязка идёт в своём окне поверх списка
  // проектов, и её ход виден там.
  const handleAutobind = (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    openAutobindModal(proj.id, proj.name);
  };

  useEffect(() => {
    if (projectList.length > 0 && !selectedValue) {
      setSelectedValue(String(projectList[0].id));
    }
  }, [projectList, selectedValue]);

  const handleConfirm = async () => {
    const proj = projectList.find(p => String(p.id) === selectedValue);
    if (!proj) return;
    await selectProjectAndOpenScenes(proj.id, proj.name);
  };

  const handleDelete = async (e: React.MouseEvent, proj: EditorProject) => {
    e.stopPropagation();
    const ok = await confirmModal({
      title: `Удалить проект «${proj.name}»?`,
      description: "Проект и все его схемы со всеми элементами будут удалены. Действие необратимо.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    await deleteProject(proj.id);
    // Локальную копию списка не держим: projectList приходит из стора, deleteProject его
    // уже обновил. Сброс выбора отдаёт его эффекту выше — тот подставит первый оставшийся.
    if (selectedValue === String(proj.id)) setSelectedValue("");
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      const created = await createProject(trimmed);
      if (!created) return;
      setNewName("");
      // Новый проект ещё не содержит схем — пропускаем загрузку списка сцен.
      await selectProjectAndOpenScenes(created.id, created.name, {skipSceneFetch: true});
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <DialogHeader
        title="Выберите проект"
        description={admin
          ? "Выберите существующий проект или создайте новый. После выбора откроется список схем проекта."
          : "Выберите проект. После выбора откроется список схем проекта."}
      />

      <DialogBody>
        {projectList.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {admin
              ? "Проектов пока нет. Создайте первый проект ниже."
              : "Нет проектов, доступных для просмотра или правки. Права выдаёт администратор."}
          </p>
        ) : (
          <ul className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
            {projectList.map(proj => (
              // Раньше это был выпадающий Select. Кнопку удаления в Select.Item вложить
              // нельзя (он сам интерактивен), поэтому строка — <li> с двумя кнопками,
              // ровно как в модалке выбора схемы.
              <li
                key={proj.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                  selectedValue === String(proj.id)
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                )}
              >
                <button
                  type="button"
                  aria-pressed={selectedValue === String(proj.id)}
                  onClick={() => setSelectedValue(String(proj.id))}
                  className="min-w-0 flex-1 truncate text-left cursor-pointer"
                >
                  {proj.name}
                </button>
                {/* Какой выпуск исполняется (или будет при вводе в эксплуатацию). */}
                {prodVersions[proj.id] != null && (
                  <Badge className="ml-2 shrink-0" title="prod-выпуск: его показывает монитор и исполняет runtime">
                    prod №{prodVersions[proj.id]}
                  </Badge>
                )}
                {(() => {
                  const grant = grantOf(proj, admin);
                  return (<>
                <IconButton
                  icon={Gauge}
                  size="xs"
                  className="ml-2"
                  onClick={(e) => { e.stopPropagation(); openProcedureLevelsModal(proj.id, proj.name, grant.edit); }}
                  title="Уровни доступа операций процедур"
                  label={`Уровни процедур проекта «${proj.name}»`}
                />
                {/* Выпуски, эксплуатация и автопривязка — только с правом правки (бэкенд: 403 NO_EDIT). */}
                {grant.edit && <>
                <IconButton
                  icon={Rocket}
                  size="xs"
                  className="ml-2"
                  onClick={(e) => { e.stopPropagation(); openReleasesModal(proj.id, proj.name); }}
                  title="Выпуски проекта: выпустить черновик, сделать prod"
                  label={`Выпуски проекта «${proj.name}»`}
                />
                <IconButton
                  icon={runtimeFlags[proj.id] ? Power : PowerOff}
                  size="xs"
                  aria-pressed={runtimeFlags[proj.id] === true}
                  className={cn("ml-2", runtimeFlags[proj.id] && "text-success enabled:hover:text-success")}
                  onClick={(e) => void handleToggleOperation(e, proj)}
                  title={runtimeFlags[proj.id]
                    ? "В эксплуатации: рантайм исполняет проект. Нажмите, чтобы вывести"
                    : "Не в эксплуатации: рантайм проект не исполняет. Нажмите, чтобы ввести"}
                  label={runtimeFlags[proj.id]
                    ? `Вывести проект «${proj.name}» из эксплуатации`
                    : `Ввести проект «${proj.name}» в эксплуатацию`}
                />
                <IconButton
                  icon={Link2}
                  size="xs"
                  className="ml-2"
                  onClick={(e) => handleAutobind(e, proj)}
                  title="Автопривязка к базе каналов"
                  label={`Автопривязка проекта «${proj.name}» к базе каналов`}
                />
                </>}
                {/* Удалять проект может только администратор. */}
                {admin && <IconButton
                  icon={X}
                  size="xs"
                  variant="danger"
                  className="ml-2"
                  onClick={(e) => void handleDelete(e, proj)}
                  title="Удалить проект"
                  label={`Удалить проект «${proj.name}»`}
                />}
                  </>);
                })()}
              </li>
            ))}
          </ul>
        )}

        {/* Создавать проект может только администратор (иначе 403 NOT_ADMIN). */}
        {admin && <div className="mt-4 flex items-center gap-2">
          <Input
            placeholder="Имя нового проекта"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            className="flex-1"
          />
          <Button variant="primary" onClick={() => void handleCreate()} disabled={!newName.trim() || isCreating}>
            {isCreating ? "Создание..." : "Создать"}
          </Button>
        </div>}
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Отмена</Button>
        <Button
          variant="primary"
          onClick={() => void handleConfirm()}
          disabled={projectList.length === 0 || !selectedValue}
        >
          Выбрать
        </Button>
      </DialogFooter>
    </>
  );
}

export function openProjectModal() {
  const {openModal} = useModalStore.getState();
  openModal(<ProjectContent />, {size: "xl"});
}
