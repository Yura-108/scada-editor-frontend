import {useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {toast} from "sonner";
import {getQueryClient} from "@/shared/api/queryClient";
import {buildPaletteComponentTree, transformElements, findTemplateRoot, type DiagramElement} from "@/core/scene";
import {SaveConflictError} from "@/core/project";
import {paletteItems as paletteItemsStatic} from "../lib/palette";
import type {PaletteItemResponseDTO, PaletteItemType} from "../types/palette.types";
import {
  fetchPaletteTemplates, requestCreateTemplate, requestDeleteTemplate, requestUpdateTemplate,
} from "../api/palette";

/**
 * Палитра: встроенные элементы плюс шаблоны с сервера.
 *
 * Шаблоны — серверные данные в кэше TanStack Query (`paletteKey`), встроенные элементы к ним
 * дописываются при чтении. Загружается список там же и тогда же, что раньше (монтирование
 * редактора, открытие и создание схемы, «схему изменил другой», импорт раскладки), — сам
 * запрос не уходит. Функции ниже работают и вне React: кэш общий (`getQueryClient`).
 */
const paletteKey = ["editor", "palette"] as const;

const toPaletteItem = (item: PaletteItemResponseDTO): PaletteItemType => ({
  id: item.id,
  type: 'custom',
  name: item.name,
  category: item.type,
  defaultProps: {},
  template: transformElements([item.rootComponent]),
  versionNo: item.version_no ?? null,
});

const fetchTemplates = async () => (await fetchPaletteTemplates()).map(toPaletteItem);

const cachedTemplates = (): PaletteItemType[] =>
  getQueryClient().getQueryData<PaletteItemType[]>(paletteKey) ?? [];

const setTemplates = (update: (prev: PaletteItemType[]) => PaletteItemType[]) =>
  getQueryClient().setQueryData<PaletteItemType[]>(paletteKey, prev => update(prev ?? []));

/** Все элементы палитры сейчас (вне React). */
export const getPaletteItems = (): PaletteItemType[] => [...paletteItemsStatic, ...cachedTemplates()];

/** Элементы палитры для компонента: перерисовывается, когда меняется список шаблонов. */
export function usePaletteItems(): PaletteItemType[] {
  const {data} = useQuery({
    queryKey: paletteKey,
    queryFn: fetchTemplates,
    // Сам не грузит: загрузку запускают те же места, что и раньше (`loadPaletteItems`).
    enabled: false,
    staleTime: Infinity,
  });
  return useMemo(() => [...paletteItemsStatic, ...(data ?? [])], [data]);
}

/**
 * Нормализует шаблон перед сохранением в палитру.
 * Шаблон НЕ привязан к конкретной сцене, поэтому:
 *   - корневой элемент получает parentId=null, parentKey=null
 *   - все остальные элементы получают parentId=null (children не существуют
 *     на бэкенде отдельно от корня шаблона; их parentKey ссылается на
 *     локальный ключ элемента внутри дерева шаблона и не трогается).
 */
const normalizeTemplateForPalette = (
  template: DiagramElement[],
  rootKey: string | undefined,
): DiagramElement[] => {
  return template.map(el => {
    if (el.key === rootKey) {
      return {...el, parentId: null, parentKey: null};
    }
    return {...el, parentId: null};
  });
};

/**
 * Сообщает о расхождении версий шаблона.
 *
 * Отдельного диалога у шаблонов нет намеренно: слияния для них не будет (у DTO
 * шаблона нет id на вложенных уровнях, переименование неотличимо от «удалили плюс
 * создали»), список расхождений не придёт, и показывать было бы нечего. Разрешение
 * одно — перечитать список и повторить правку от свежей версии.
 */
const reportTemplateConflict = (err: SaveConflictError) => {
  const {base_version, current_version} = err.conflict;
  toast.error("Шаблон изменил другой пользователь", {
    description:
      `Вы правили версию ${base_version ?? "—"}, на сервере уже ${current_version ?? "—"}. ` +
      "Обновите список шаблонов и повторите правку.",
    duration: 12_000,
  });
};

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/** Корень шаблона, собранный для сервера; `null` — собрать не удалось (тост уже показан). */
const buildRootComponent = (template: DiagramElement[]) => {
  // Корень ищем общим правилом: шаблоном может быть и группа, и одиночный
  // элемент — у второго группы нет вовсе, и поиск по типу давал undefined.
  const rootElementKey = findTemplateRoot(template)?.key;
  const normalizedTemplate = normalizeTemplateForPalette(template, rootElementKey);
  const rootComponent = buildPaletteComponentTree(normalizedTemplate, rootElementKey);
  if (!rootComponent) {
    toast.error("Не удалось собрать корневой компонент шаблона");
    return null;
  }
  return rootComponent;
};

/** Перечитать шаблоны с сервера. Ошибка — тост, прежний список остаётся. */
export async function loadPaletteItems(): Promise<void> {
  try {
    await getQueryClient().fetchQuery({queryKey: paletteKey, queryFn: fetchTemplates, staleTime: 0});
    // Успешный тост здесь не нужен: загрузка идёт при каждом монтировании
    // редактора и после каждого createScene — получался спам.
  } catch (err) {
    console.error(err);
    toast.error(messageOf(err, "Ошибка загрузки списка элементов"));
  }
}

export async function createPaletteItem(paletteItem: Omit<PaletteItemType, 'id'>): Promise<void> {
  try {
    if (!paletteItem.template) return;
    const rootComponent = buildRootComponent(paletteItem.template);
    if (!rootComponent) return;

    const response = await requestCreateTemplate({
      name: paletteItem.name,
      type: paletteItem.category,
      rootComponent,
      // У шаблона тело и так объект — конверта нет, поля версионирования едут рядом.
      // Новый шаблон версий не имеет, based_on_version не отправляем.
      save_kind: "MANUAL",
    });

    const created: PaletteItemType = {...toPaletteItem(response), defaultProps: paletteItem.defaultProps};
    setTemplates(prev => [...prev, created]);
    toast.success("Шаблон сохранён");
  } catch (err) {
    console.error(err);
    if (err instanceof SaveConflictError) return reportTemplateConflict(err);
    toast.error(messageOf(err, "Ошибка сохранения шаблона"));
  }
}

export async function updatePaletteItem(id: number, paletteItem: Omit<PaletteItemType, 'id'>): Promise<void> {
  try {
    if (!paletteItem.template) return;
    const rootComponent = buildRootComponent(paletteItem.template);
    if (!rootComponent) return;

    // База — версия, на которой пользователь правил шаблон. Берём из списка, а не
    // из аргумента: вызывающий передаёт Omit<PaletteItemType,'id'> из формы, где
    // версии нет, и подставить туда её значило бы просить UI помнить о контракте.
    const basedOnVersion = paletteItem.versionNo ?? getPaletteItems().find(i => i.id === id)?.versionNo;

    const response = await requestUpdateTemplate(id, {
      name: paletteItem.name,
      type: paletteItem.category,
      rootComponent,
      save_kind: "MANUAL",
      // Версий нет — это первое сохранение шаблона, поле не отправляем вовсе.
      ...(basedOnVersion != null ? {based_on_version: basedOnVersion} : {}),
    });

    const updated: PaletteItemType = {
      ...toPaletteItem(response),
      defaultProps: paletteItem.defaultProps,
      // Ответ без version_no (старый контракт) не должен затирать известную версию.
      versionNo: response.version_no ?? basedOnVersion ?? null,
    };
    setTemplates(prev => prev.map(item => (item.id === id ? updated : item)));

    toast.success("Шаблон успешно обновлен");
  } catch (err) {
    console.error(err);
    if (err instanceof SaveConflictError) return reportTemplateConflict(err);
    toast.error(messageOf(err, "Ошибка обновления шаблона"));
  }
}

export async function deletePaletteItem(id: number): Promise<void> {
  try {
    await requestDeleteTemplate(id);
    setTemplates(prev => prev.filter(item => item.id !== id));
    toast.success("Шаблон удалён");
  } catch (err) {
    console.error(err);
    toast.error(messageOf(err, "Ошибка удаления шаблона"));
  }
}

/** Удаляет все шаблоны группы по одному; ошибка одного не останавливает остальные. */
export async function deletePaletteCategory(category: string): Promise<void> {
  const items = getPaletteItems().filter(item => item.category === category);
  let failed = 0;
  for (const item of items) {
    try {
      await requestDeleteTemplate(item.id);
      setTemplates(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error(err);
      failed++;
    }
  }
  if (failed === 0) toast.success(`Группа «${category}» удалена`);
  else toast.error(`Удалено с ошибками: ${failed} из ${items.length}`);
}
