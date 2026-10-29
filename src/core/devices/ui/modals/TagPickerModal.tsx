"use client";

import React, {useEffect, useMemo, useRef} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import DeviceTreePanel from "../DeviceTreePanel";
import {Button, ModalFooter} from "@/shared/ui/Button";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useDeviceTreeStore} from "../../model/deviceTreeStore";

interface Options {
  title?: string;
  /** Что пояснить под заголовком: куда пойдёт выбранный тег. */
  description?: string;
}

interface ContentProps extends Options {
  resolve: (path: string | null) => void;
}

/**
 * Канал (тег) — лист дерева не выше четвёртого уровня: площадка.проект.устройство.канал.
 * Площадка, проект и устройство — папки, писать в них нечего.
 */
const useIsChannel = (key: string | null): boolean => {
  const nodes = useDeviceTreeStore(s => s.nodes);
  return useMemo(() => {
    if (!key || key.split(".").length < 4) return false;
    return !nodes.some(n => n.parentKey === key || n.key.startsWith(`${key}.`));
  }, [nodes, key]);
};

function TagPickerContent({title = "Выбор тега ПЛК", description, resolve}: ContentProps) {
  const closeModal = useModalStore(s => s.closeModal);
  const selected = useDeviceTreeStore(s => s.selectedDevice);
  const isChannel = useIsChannel(selected);
  const resolved = useRef(false);

  const finish = (path: string | null) => {
    if (resolved.current) return;
    resolved.current = true;
    resolve(path);
  };

  // Закрытие крестиком, Esc или щелчком мимо — тоже ответ «ничего не выбрано». Проверка
  // откладывается: StrictMode в разработке размонтирует и тут же монтирует окно заново.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => { if (!mounted.current) finish(null); }, 0);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = () => {
    if (!selected || !isChannel) return;
    finish(selected);
    closeModal();
  };

  return (
    <div className="w-full max-w-2xl">
      <Dialog.Title className="text-xl font-semibold mb-1">{title}</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
        {description ?? "Раскройте площадку, проект и устройство и выберите канал. Можно искать по имени или пути."}
      </Dialog.Description>

      <div className="h-[55vh]">
        <DeviceTreePanel fill />
      </div>

      <div className="mt-3 text-sm min-h-10">
        {selected ? (
          <>
            <span className="text-neutral-500">Выбрано: </span>
            <code className="break-all">{selected}</code>
            {!isChannel && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Это папка (площадка, проект или устройство) — выберите конечный канал внутри неё.
              </p>
            )}
          </>
        ) : (
          <span className="text-neutral-500">Ничего не выбрано</span>
        )}
      </div>

      <ModalFooter className="mt-4">
        <Button onClick={() => { finish(null); closeModal(); }}>Отмена</Button>
        <Button variant="primary" onClick={choose} disabled={!isChannel}>Выбрать</Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Выбор тега ПЛК в окне с деревом каналов — как выбор файла в проводнике, без набора пути
 * руками. Резолвится полным путём канала или `null`, если окно закрыли.
 */
export function pickTag(options: Options = {}): Promise<string | null> {
  return new Promise(resolve => {
    useModalStore.getState().openModal(<TagPickerContent {...options} resolve={resolve} />, {legacyLayout: true});
  });
}
