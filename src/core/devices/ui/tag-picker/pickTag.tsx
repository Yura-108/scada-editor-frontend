"use client";

import React, {useEffect, useRef, useState, type ReactNode} from "react";
import {shortTagPath} from "@/core/scene";
import {Button} from "@/shared/ui/Button";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {TagTree} from "./TagTree";

interface PickOptions {
  title?: string;
  /** Что пояснить под заголовком: куда пойдёт выбранный тег. */
  description?: ReactNode;
}

interface PickManyOptions extends PickOptions {
  /** Пояснение над кнопками — например, что дальше сделать с выбранными тегами. */
  note?: ReactNode;
  confirmLabel?: string;
}

const DEFAULT_DESCRIPTION = "Раскройте площадку, проект и устройство и выберите канал. Можно искать по имени или пути.";

/**
 * Ответ вызывающему ровно один раз. Закрытие крестиком, Esc или щелчком мимо — тоже ответ:
 * «ничего не выбрано». Проверка откладывается: StrictMode в разработке размонтирует и тут же
 * монтирует окно заново.
 */
function useSettleOnce<T>(resolve: (value: T | null) => void) {
  const settled = useRef(false);
  const settle = (value: T | null) => {
    if (settled.current) return;
    settled.current = true;
    resolve(value);
  };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => { if (!mounted.current) settle(null); }, 0);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return settle;
}

function PickTagContent({title = "Выбор тега ПЛК", description = DEFAULT_DESCRIPTION, resolve}: PickOptions & {
  resolve: (tag: string | null) => void;
}) {
  const closeModal = useCloseModal();
  const settle = useSettleOnce(resolve);
  const [tag, setTag] = useState<string | null>(null);

  const done = (value: string | null) => {
    settle(value);
    closeModal();
  };

  return (
    <>
      <DialogHeader title={title} description={description} />
      <DialogBody className="flex flex-col gap-3">
        <TagTree className="h-[55vh]" value={tag} onChange={setTag} />
        <p className="shrink-0 truncate text-xs text-muted-foreground" title={tag ?? undefined}>
          {tag ? `Выбран тег: ${shortTagPath(tag)}` : "Выберите конечный узел дерева — у ветки значения нет."}
        </p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => done(null)}>Отмена</Button>
        <Button variant="primary" onClick={() => tag && done(tag)} disabled={!tag}>Выбрать</Button>
      </DialogFooter>
    </>
  );
}

function PickTagsContent({title = "Выбор тегов ПЛК", description = DEFAULT_DESCRIPTION, note, confirmLabel = "Добавить", resolve}: PickManyOptions & {
  resolve: (tags: string[] | null) => void;
}) {
  const closeModal = useCloseModal();
  const settle = useSettleOnce(resolve);
  const [tags, setTags] = useState<string[]>([]);

  const done = (value: string[] | null) => {
    settle(value);
    closeModal();
  };

  return (
    <>
      <DialogHeader title={title} description={description} />
      <DialogBody className="flex flex-col gap-3">
        <TagTree multiple className="h-[55vh]" onChange={setTags} />
        {tags.length > 0 && (
          <p className="shrink-0 truncate text-xs text-muted-foreground" title={tags.join("\n")}>
            Последний выбранный: {shortTagPath(tags[tags.length - 1])}
          </p>
        )}
        {note && (
          <div className="shrink-0 rounded-lg border bg-muted px-4 py-2.5 text-xs text-muted-foreground">{note}</div>
        )}
      </DialogBody>
      <DialogFooter>
        <span className="mr-auto self-center text-sm text-muted-foreground">Выбрано тегов: {tags.length}</span>
        <Button onClick={() => done(null)}>Отмена</Button>
        <Button variant="primary" onClick={() => done(tags)} disabled={!tags.length}>{confirmLabel}</Button>
      </DialogFooter>
    </>
  );
}

/**
 * Выбор одного тега (канала) в окне с деревом — без набора пути руками. Окно открывается
 * поверх того, из которого вызвано. Резолвится полным путём канала или `null`.
 */
export function pickTag(options: PickOptions = {}): Promise<string | null> {
  return new Promise(resolve => {
    useModalStore.getState().pushModal(<PickTagContent {...options} resolve={resolve} />, {size: "lg"});
  });
}

/** Выбор нескольких тегов. Резолвится путями каналов (только конечные узлы) или `null`. */
export function pickTags(options: PickManyOptions = {}): Promise<string[] | null> {
  return new Promise(resolve => {
    useModalStore.getState().pushModal(<PickTagsContent {...options} resolve={resolve} />, {size: "lg"});
  });
}
