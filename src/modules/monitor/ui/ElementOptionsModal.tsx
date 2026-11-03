"use client";

import React from "react";
import {AlertTriangle} from "lucide-react";
import {closeFloatingWindow, openFloatingWindow} from "../model/useFloatingWindowsStore";
import {useSceneView, getSceneView} from "@/core/scene";
import {getRuntimeTagValue} from "@/core/runtime";
import {Button, ModalFooter} from "@/shared/ui/Button";
import {useOpenScene} from "@/core/project";
import {useLiveValueTick} from "../model/useLiveValueTick";
import {useOptionDrafts} from "../model/options/useOptionDrafts";
import {TagPropertyRow} from "./options/TagPropertyRow";

interface Props {
  elementKey: string;
}

interface ContentProps extends Props {
  /** Закрыть именно это плавающее окно. */
  onClose: () => void;
}

function ElementOptionsContent({elementKey, onClose}: ContentProps) {
  const element = useSceneView((s) => s.elements.find(el => el.key === elementKey));
  const projectId = useOpenScene((s) => s.currentProject?.id ?? null);

  const tagProps = (element?.properties ?? []).filter(p => p.property_type === "Тег");

  const {drafts, setDraft, writingTags, isBusy, filledRows, sendWrites, write} = useOptionDrafts(tagProps, projectId);
  useLiveValueTick();

  const asText = (v: string | null | undefined) => (v == null ? "нет данных" : String(v));
  /** То же значение, что нарисовано на холсте: движок держит их в рефах, а не в сторе. */
  const shownValueOf = (tagId: string) => asText(getRuntimeTagValue(tagId));

  return (
    // Плавающее окно (заголовок — в его шапке): высоту задаёт окно, прокручивается список.
    <div className="flex flex-col flex-1 min-h-0">
      <p className="shrink-0 mb-4 text-muted-foreground text-sm">
        Значения привязанных тегов. Записанное показывается, пока контроллер не пришлёт
        следующее.
      </p>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
        {tagProps.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground italic">
            У компонента нет свойств, привязанных к тегам
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
            {tagProps.map((p) => {
              const tagId = p.tag_id ?? "";
              return (
                <TagPropertyRow
                  key={p.id ?? p.name}
                  property={p}
                  shownValue={shownValueOf(tagId)}
                  draft={drafts[tagId] ?? ""}
                  isWriting={writingTags.includes(tagId)}
                  isBusy={isBusy}
                  onDraft={(value) => setDraft(tagId, value)}
                  onWrite={() => write(p)}
                />
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter className="shrink-0 mt-6 pt-4 border-t border-border">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle size={14} />
          Запись в ПЛК необратима
        </span>
        {/* Пакетная запись. Одна строка обходится кнопкой в самой строке, поэтому кнопка
            появляется только там, где есть что объединять. */}
        {tagProps.length > 1 && (
          <Button
            variant="danger"
            onClick={() => void sendWrites(filledRows)}
            disabled={isBusy || !filledRows.length}
            title={filledRows.length
              ? "Записать все заданные значения одним запросом"
              : "Задайте значение хотя бы у одной строки"}
          >
            {isBusy
              ? "Запись..."
              : `Применить для всех${filledRows.length ? ` (${filledRows.length})` : ""}`}
          </Button>
        )}
        <Button onClick={onClose}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Открывает «Опции» компонента из меню монитора — плавающим окном, а не модалкой: оператор
 * держит его открытым и продолжает смотреть и нажимать схему. Окно на компонент одно —
 * повторный вызов поднимает его наверх; «Опции» разных компонентов открываются рядом.
 */
export function openElementOptionsModal(props: Props) {
  const id = `options:${props.elementKey}`;
  const element = getSceneView().elements.find(el => el.key === props.elementKey);
  openFloatingWindow({
    id,
    kind: "options",
    title: `Опции · ${element?.label || element?.type || "компонент"}`,
    width: 480,
    content: <ElementOptionsContent {...props} onClose={() => closeFloatingWindow(id)} />,
  });
}
