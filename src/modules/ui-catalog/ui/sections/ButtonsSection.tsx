"use client";

import React, {useState} from "react";
import {Pause, Pin, Play, Plus, Save, Square, Trash2} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {SegmentedControl} from "@/shared/ui/SegmentedControl";
import {CatalogSection, Demo} from "../CatalogSection";

const VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;
const ICON_VARIANTS = ["ghost", "secondary", "danger"] as const;
const ICON_SIZES = ["xs", "sm", "md"] as const;

export function ButtonsSection() {
  return (
    <CatalogSection
      id="buttons"
      title="Кнопки"
      description="Button — текстовая кнопка, IconButton — кнопка-иконка (label обязателен: его читает скринридер), SegmentedControl — выбор одного из нескольких."
    >
      <Buttons />
    </CatalogSection>
  );
}

function Buttons() {
  const [pinned, setPinned] = useState(false);
  const [mode, setMode] = useState<"run" | "pause" | "stop">("run");

  return (
    <>
      {(["md", "sm"] as const).map(size => (
        <Demo key={size} label={`Button, size="${size}"`}>
          {VARIANTS.map(v => <Button key={v} variant={v} size={size}>{v}</Button>)}
          <Button variant="primary" size={size}><Save size={14} />С иконкой</Button>
          <Button size={size} disabled>disabled</Button>
        </Demo>
      ))}
      <Demo label="IconButton: варианты × размеры">
        {ICON_VARIANTS.map(v => ICON_SIZES.map(s => (
          <IconButton key={v + s} icon={v === "danger" ? Trash2 : Plus} variant={v} size={s} label={`${v} ${s}`} title={`${v}, ${s}`} />
        )))}
      </Demo>
      <Demo label="IconButton: pressed, busy, disabled">
        <IconButton
          icon={Pin}
          pressed={pinned}
          label={pinned ? "Открепить" : "Закрепить"}
          title="pressed — нажмите"
          onClick={() => setPinned(p => !p)}
        />
        <IconButton icon={Save} busy label="Сохраняется" title="busy" />
        <IconButton icon={Save} disabled label="Недоступно" title="disabled" />
      </Demo>
      <Demo label="SegmentedControl (тон у пункта, disabled пропускается стрелками)">
        <SegmentedControl
          aria-label="Режим работы"
          value={mode}
          onValueChange={setMode}
          items={[
            {value: "run", label: "Пуск", icon: Play, tone: "success"},
            {value: "pause", label: "Пауза", icon: Pause, tone: "warning"},
            {value: "stop", label: "Стоп", icon: Square, tone: "destructive", disabled: true},
          ]}
        />
      </Demo>
    </>
  );
}
