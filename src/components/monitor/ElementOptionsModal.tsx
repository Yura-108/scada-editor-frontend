"use client";

import React, {useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {ChevronRight, Waypoints} from "lucide-react";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {shortTagPath} from "@/lib/editor/tagPath";
import OpenAddPropertyModal from "@/components/ui/OpenChooseTagModal";
import {PropertyCreateDto} from "@/types/tags.types";
import {Button, ModalFooter} from "@/components/ui/Button";

interface Props {
  elementKey: string;
}

/**
 * Корни дерева каналов, которые нужно подгрузить, чтобы выбрать тег.
 *
 * `tag_id` — путь узла точками (`проект.устройство.…`), а `loadNodes` принимает список
 * ключей проектов, то есть первых сегментов. Берём их прямо из уже привязанных тегов:
 * монитор в раздел «База каналов» не заходит и никакого выбранного проекта не помнит.
 */
const rootPathsOf = (properties: PropertyCreateDto[]): string[] => {
  const roots = new Set<string>();
  for (const p of properties) {
    const root = p.tag_id?.split(".")[0];
    if (root) roots.add(root);
  }
  return [...roots];
};

function ElementOptionsContent({elementKey}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const element = useEditorStore((s) => s.elements.find(el => el.key === elementKey));
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  const tagProps = (element?.properties ?? []).filter(p => p.property_type === "Тег");

  // Дерево каналов грузим один раз при открытии: в мониторе его никто не загружал,
  // и модалка выбора тега показала бы пустое дерево. Заодно сбрасываем selectedDevice —
  // он глобальный синглтон и иначе притащит выбор из прошлого открытия.
  useEffect(() => {
    useDeviceStore.setState({selectedDevice: null});

    const {nodes, loadedRootPath, loadNodes} = useDeviceStore.getState();
    if (nodes.length) return;

    const roots = rootPathsOf(tagProps);
    const target = roots.length ? roots : (loadedRootPath ?? []);
    if (!target.length) return;

    setIsLoadingTree(true);
    void loadNodes(target)
      .catch(() => {})            // тост уже показал сам loadNodes
      .finally(() => setIsLoadingTree(false));
    // Только при монтировании: список тегов элемента за время жизни модалки не меняется.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTagPicker = (property: PropertyCreateDto) => {
    // persist — правка уйдёт точечным PUT сразу, без сохранения всей сцены.
    OpenAddPropertyModal({elementKey, property, persist: true});
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Опции · {element?.label || element?.type || "компонент"}
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Привязка свойств компонента к каналам. Изменение сохраняется сразу и
          перезапускает сессию монитора.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {isLoadingTree && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загрузка базы каналов...
          </div>
        )}

        {tagProps.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 italic">
            У компонента нет свойств, привязанных к тегам
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800/70">
            {tagProps.map((p) => (
              <button
                key={p.id ?? p.name}
                type="button"
                onClick={() => openTagPicker(p)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  "hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer",
                )}
              >
                <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    {p.name}
                  </span>
                  {/* Полный путь — в title: подпись короткая, но проверить узел можно наведением. */}
                  <span
                    className="block truncate text-xs text-gray-500 dark:text-gray-400"
                    title={p.tag_id ?? undefined}
                  >
                    {p.tag_id ? shortTagPath(p.tag_id) : "тег не назначен"}
                  </span>
                </span>
                {p.id == null && (
                  <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                    не сохранено
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/** Открывает «Опции» компонента из меню монитора. */
export function openElementOptionsModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<ElementOptionsContent {...props} />);
}
