"use client";

import React, {useEffect, useState} from "react";
import {ChevronDown, ChevronRight, History, ListOrdered, Pencil, Plus, RefreshCw, Save, Tags, Trash2, Undo2} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useRecipeStore} from "@/store/useRecipeStore";
import {Recipe, RecipeStep} from "@/types/recipe.types";
import openRecipeEditorModal from "@/components/editor/recipes/RecipeEditorModal";
import {openRecipeHistoryModal} from "@/components/editor/recipes/RecipeHistoryModal";
import {setStepValueAt, stepValueText, stepsChanged} from "@/lib/editor/recipeSteps";
import {validateRecipe} from "@/lib/editor/recipeValidation";
import {shortTagPath} from "@/lib/editor/tagPath";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {useEditorStore} from "@/store/useEditorStore";

/**
 * Процедурные рецепты открытого проекта. Рецепт не принадлежит ни компоненту, ни сцене —
 * он описывает процедуру над тегами, — но принадлежит ПРОЕКТУ и до мойки доезжает только
 * с выпуском (`docs/contract/2026-10-19-recipes-in-project-contract.md`).
 *
 * Состав показывается ЗДЕСЬ ЖЕ, разворотом строки: рецепт не содержимое схемы, и выносить
 * его на холст незачем. Значения уставок правятся прямо в таблице тегов — но всегда
 * в пределах ВЫБРАННОГО шага: собственного значения у тега в контракте нет, оно
 * принадлежит действию шага.
 */
const VALUE_TYPE_LABELS: Record<string, string> = {
  number: "число",
  bool: "логический",
  string: "строка",
};

const cellClass = "px-4 py-2 align-top";
const headClass = "px-4 py-2 font-medium";

const inputClass = cn(
  "w-full rounded-md border bg-white dark:bg-gray-900/80",
  "border-gray-300 dark:border-gray-700/80",
  "px-2 py-1 text-sm text-gray-900 dark:text-gray-100",
  "placeholder:text-gray-400 dark:placeholder:text-gray-600",
  "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
  "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all",
);

export function RecipesPanel() {
  const {projectId: loadedFor, recipes, isLoading, loadError, loadRecipes, updateRecipe, deleteRecipe} = useRecipeStore();
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  /** Незасохранённые правки шагов по рецептам. Черновик не теряется при сворачивании. */
  const [drafts, setDrafts] = useState<Record<string, RecipeStep[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // Смотреть — `view`/`edit`, менять — `edit` в этом проекте (иначе бэкенд ответит 403 NO_EDIT).
  const canEditRecipes = useCurrentProjectGrant().edit;

  // Флага загрузки в компоненте нет намеренно: он в сторе, иначе это был бы `setState`
  // прямо в эффекте (`projectId` ставится до запроса и гасит повторный вызов).
  useEffect(() => {
    if (projectId != null && loadedFor !== projectId) void loadRecipes(projectId);
  }, [projectId, loadedFor, loadRecipes]);

  // Черновики шагов и раскрытая строка принадлежат рецептам прежнего проекта: id-слаги
  // в разных проектах совпадают («дезинфекция»), и черновик молча уехал бы в чужой рецепт.
  // Сброс — по смене проекта во время рендера, а не в эффекте (`set-state-in-effect`).
  const [draftsFor, setDraftsFor] = useState(projectId);
  if (draftsFor !== projectId) {
    setDraftsFor(projectId);
    setDrafts({});
    setExpanded(null);
  }

  const stepsOf = (recipe: Recipe): RecipeStep[] => drafts[recipe.id] ?? recipe.steps ?? [];
  const isDirty = (recipe: Recipe) => drafts[recipe.id] !== undefined;

  const dropDraft = (id: string) =>
    setDrafts(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });

  const editValue = (recipe: Recipe, index: number, tagName: string, text: string) => {
    const tag = (recipe.tags ?? []).find(t => t.name === tagName);
    if (!tag) return;

    const next = setStepValueAt(stepsOf(recipe), index, tag, text);
    // Правка, вернувшая всё к исходному, снимает и признак «не сохранено» —
    // иначе кнопка звала бы сохранять то, что и так лежит на сервере.
    if (!stepsChanged(next, recipe.steps ?? [])) dropDraft(recipe.id);
    else setDrafts(prev => ({...prev, [recipe.id]: next}));
  };

  const handleSave = async (recipe: Recipe) => {
    const steps = stepsOf(recipe);
    const problems = validateRecipe({name: recipe.name, tags: recipe.tags, steps});
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }

    setSavingId(recipe.id);
    try {
      // `pause_action` здесь НЕ шлём намеренно: для бэкенда отсутствие поля означает
      // «оставить прежнее», а пустой массив — «очистить». Эта панель правит только значения
      // шагов и о безопасном состоянии ничего не знает; добавив сюда `pause_action: []`,
      // мы бы молча стирали его при каждом сохранении значений. Правится оно в форме рецепта.
      const saved = await updateRecipe(recipe.id, {name: recipe.name, tags: recipe.tags, steps});
      if (saved) dropDraft(recipe.id);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    const confirmed = await confirmModal({
      title: `Удалить рецепт «${recipe.name}»?`,
      description: "Процедура и все её шаги будут удалены безвозвратно.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (confirmed) {
      dropDraft(recipe.id);
      void deleteRecipe(recipe.id);
    }
  };

  const toggle = (recipe: Recipe) => {
    const opening = expanded !== recipe.id;
    setExpanded(opening ? recipe.id : null);
    if (opening) setStepIndex(0);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        {/* Единый вид заголовка панели (как в «Слоях» и «Свойствах»). */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Рецепты
        </h3>

        {canEditRecipes && <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            "bg-blue-600 text-white hover:bg-blue-500",
          )}
          onClick={() => openRecipeEditorModal()}
        >
          <Plus size={16} />
          Создать рецепт
        </button>}
      </div>

      {projectId == null ? (
        <div className="flex min-h-[180px] items-center justify-center text-gray-500 dark:text-gray-400">
          Выберите проект — рецепты принадлежат проекту.
        </div>
      ) : isLoading ? (
        <div className="flex min-h-[180px] items-center justify-center text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загрузка рецептов...
          </div>
        </div>
      ) : loadError ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
          <p>Не удалось загрузить рецепты: {loadError}</p>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => void loadRecipes(projectId)}
          >
            <RefreshCw size={16} />
            Повторить
          </button>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="text-5xl opacity-30">📋</span>
          <p>Рецептов пока нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                <th className="w-10" />
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Название</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Теги</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Шаги</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5 text-center")}>Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70 text-sm text-gray-700 dark:text-gray-300">
              {recipes.map((recipe) => {
                const isOpen = expanded === recipe.id;
                const tags = recipe.tags ?? [];
                const steps = stepsOf(recipe);
                const dirty = isDirty(recipe);
                const index = Math.min(stepIndex, Math.max(0, steps.length - 1));
                const step = steps[index];

                return (
                  <React.Fragment key={recipe.id}>
                    <tr
                      className="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      onClick={() => toggle(recipe)}
                    >
                      <td className="pl-4 text-gray-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {recipe.name}
                        {dirty && (
                          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                            не сохранено
                          </span>
                        )}
                        <div className="text-xs font-normal text-gray-400 dark:text-gray-600">{recipe.id}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5"><Tags size={14} />{tags.length}</span>
                      </td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5"><ListOrdered size={14} />{steps.length}</span>
                      </td>
                      {/* Клик по кнопкам не должен заодно сворачивать строку. */}
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-3">
                          {/* История доступна и на чтение: смотреть версии может и `view`. */}
                          {recipe.document_id != null && (
                            <button
                              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                              title="История версий"
                              onClick={() => openRecipeHistoryModal({
                                recipe,
                                documentId: recipe.document_id!,
                                editable: canEditRecipes,
                                dirty,
                              })}
                            >
                              <History size={16} />
                            </button>
                          )}
                          {canEditRecipes && <button
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
                            title="Редактировать"
                            onClick={() => openRecipeEditorModal({recipe})}
                          >
                            <Pencil size={16} />
                          </button>}
                          {canEditRecipes && <button
                            className="text-red-600 dark:text-red-400 hover:text-red-500 transition-colors"
                            title="Удалить"
                            onClick={() => void handleDelete(recipe)}
                          >
                            <Trash2 size={16} />
                          </button>}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-gray-50/60 dark:bg-gray-950/40">
                        <td colSpan={5} className="px-6 py-4 space-y-5">
                          {steps.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              У рецепта нет шагов — задавать значения негде.
                            </p>
                          ) : (
                            <>
                              {/* ─── Выбор шага ─── */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                  Шаг
                                </span>
                                {steps.map((s, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setStepIndex(i)}
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                      i === index
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700",
                                    )}
                                  >
                                    {i + 1}. {s.name || "без названия"}
                                  </button>
                                ))}
                              </div>

                              {/* ─── Манифест со значениями выбранного шага ─── */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Теги и значения на шаге {index + 1}
                                  </span>
                                  {canEditRecipes && <div className="flex items-center gap-2">
                                    {dirty && (
                                      <button
                                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                        onClick={() => dropDraft(recipe.id)}
                                      >
                                        <Undo2 size={14} />
                                        Сбросить
                                      </button>
                                    )}
                                    <button
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                                        dirty && savingId !== recipe.id
                                          ? "bg-blue-600 text-white hover:bg-blue-500"
                                          : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed",
                                      )}
                                      disabled={!dirty || savingId === recipe.id}
                                      onClick={() => void handleSave(recipe)}
                                    >
                                      <Save size={14} />
                                      {savingId === recipe.id ? "Сохранение…" : "Сохранить"}
                                    </button>
                                  </div>}
                                </div>

                                {tags.length === 0 ? (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    Манифест пуст — шагам нечего записывать.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60">
                                    <table className="w-full text-left border-collapse text-sm">
                                      <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                          <th className={cn(headClass, "w-10")}>№</th>
                                          <th className={headClass}>Имя</th>
                                          <th className={headClass}>Тег</th>
                                          <th className={headClass}>Тип</th>
                                          <th className={headClass}>Описание</th>
                                          <th className={cn(headClass, "w-44")}>Значение</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70">
                                        {tags.map((tag, i) => {
                                          const text = step ? stepValueText(step, tag.name) : "";
                                          return (
                                            <tr key={tag.name}>
                                              <td className={cn(cellClass, "text-gray-400")}>{i + 1}</td>
                                              <td className={cn(cellClass, "font-medium text-gray-900 dark:text-gray-100")}>
                                                {tag.name}
                                              </td>
                                              {/* Полный путь — в подсказке: в строку он не помещается. */}
                                              <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")} title={tag.tag}>
                                                {shortTagPath(tag.tag)}
                                              </td>
                                              <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")}>
                                                {tag.value_type
                                                  ? VALUE_TYPE_LABELS[tag.value_type] ?? tag.value_type
                                                  : <span className="italic text-gray-400">без проверки</span>}
                                              </td>
                                              <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")}>
                                                {tag.description || "—"}
                                              </td>
                                              <td className={cellClass}>
                                                {tag.value_type === "bool" ? (
                                                  <select
                                                    className={inputClass}
                                                    value={text}
                                                    onChange={(e) => editValue(recipe, index, tag.name, e.target.value)}
                                                  >
                                                    <option value="">не пишется</option>
                                                    <option value="true">true</option>
                                                    <option value="false">false</option>
                                                  </select>
                                                ) : (
                                                  <input
                                                    className={inputClass}
                                                    value={text}
                                                    placeholder="не пишется"
                                                    onChange={(e) => editValue(recipe, index, tag.name, e.target.value)}
                                                  />
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  Пустое поле — тег на этом шаге не записывается. Условие перехода
                                  и таймаут шага правятся в редакторе рецепта.
                                </p>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-500">
        Выполняется процедура в мониторе — вкладка «Процедуры». До мойки рецепт доходит только
        с выпуском: после сохранения выпустите проект и назначьте выпуск prod.
      </p>
    </div>
  );
}
