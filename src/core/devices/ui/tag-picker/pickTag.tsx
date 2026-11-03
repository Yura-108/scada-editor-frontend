"use client";

import React, {useEffect, useRef, useState, type ReactNode} from "react";
import {shortTagPath} from "@/core/scene";
import {X} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {TagTree} from "./TagTree";

interface PickOptions {
  title?: string;
  /** Что пояснить под заголовком: куда пойдёт выбранный тег. */
  description?: ReactNode;
  /** Подпись главной кнопки: «Выбрать», «Привязать», «Добавить». */
  confirmLabel?: string;
}

interface PickManyOptions extends PickOptions {
  /** Пояснение над кнопками — например, что дальше сделать с выбранными тегами. */
  note?: ReactNode;
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

function PickTagContent({title = "Выбор тега ПЛК", description = DEFAULT_DESCRIPTION, confirmLabel = "Выбрать", resolve}: PickOptions & {
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
        <Button variant="primary" onClick={() => tag && done(tag)} disabled={!tag}>{confirmLabel}</Button>
      </DialogFooter>
    </>
  );
}

/**
 * Выбранные теги под деревом: у каждого крестик, сверху «Снять все». Высота блока постоянная —
 * раньше строка «Последний выбранный» появлялась после первой отметки и сдвигала дерево под
 * курсором; длинный список прокручивается внутри.
 */
function SelectedTags({tags, onChange}: {tags: string[]; onChange: (tags: string[]) => void}) {
  return (
    <div className="flex h-28 shrink-0 flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Выбрано тегов: {tags.length}</span>
        {tags.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>Снять все</Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar rounded-lg border px-2 py-1.5">
        {tags.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">Отметьте каналы в дереве — они появятся здесь.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <li key={tag} title={tag}
                className="inline-flex max-w-full items-center gap-0.5 rounded-md border bg-muted py-0.5 pl-2 pr-0.5 text-xs text-foreground">
                <span className="truncate">{shortTagPath(tag)}</span>
                <IconButton icon={X} label={`Убрать «${shortTagPath(tag)}»`} size="xs" className="h-5 w-5"
                  onClick={() => onChange(tags.filter(t => t !== tag))} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
        <TagTree multiple className="h-[45vh]" value={tags} onChange={setTags} />
        <SelectedTags tags={tags} onChange={setTags} />
        {note && (
          <div className="shrink-0 rounded-lg border bg-muted px-4 py-2.5 text-xs text-muted-foreground">{note}</div>
        )}
      </DialogBody>
      <DialogFooter>
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
