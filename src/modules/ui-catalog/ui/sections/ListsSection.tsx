"use client";

import React, {useState} from "react";
import {Tag, X} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {IconButton} from "@/shared/ui/IconButton";
import {MultiSelect} from "@/shared/ui/MultiSelect";
import {Field} from "@/shared/ui/field/Field";
import {PickerSelect} from "@/shared/ui/field/PickerSelect";
import {Select} from "@/shared/ui/field/Select";
import type {FieldSize} from "@/shared/ui/field/fieldStyles";
import {CatalogSection, Demo} from "../CatalogSection";
import {SAMPLE_OPTIONS, SAMPLE_PROJECTS} from "../../lib/sampleData";

export function ListsSection() {
  return (
    <CatalogSection
      id="lists"
      title="Списки"
      description="Select — обычный выпадающий список; PickerSelect — когда в строках нужны кнопки (выбор проекта и схемы в редакторе), поиск появляется с 8 пунктов; MultiSelect — выбор нескольких."
    >
      <Lists />
    </CatalogSection>
  );
}

function Lists() {
  const [value, setValue] = useState("auto");
  const [project, setProject] = useState<string | null>("1");
  const [multi, setMulti] = useState<string[]>(["auto"]);
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const picked = projects.find(p => p.value === project);

  return (
    <>
      {(["md", "sm"] as FieldSize[]).map(size => (
        <Demo key={size} label={`Select, size="${size}"`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Режим" size={size}>
            <Select size={size} value={value} onValueChange={setValue} options={SAMPLE_OPTIONS} />
          </Field>
          <Field label="disabled" size={size}>
            <Select size={size} disabled value={value} onValueChange={setValue} options={SAMPLE_OPTIONS} />
          </Field>
        </Demo>
      ))}
      <Demo label="PickerSelect с кнопками в строках">
        <PickerSelect
          aria-label="Проект"
          placeholder="Проект…"
          className="w-56"
          contentClassName="min-w-80"
          value={project}
          valueLabel={picked?.label}
          onValueChange={setProject}
          emptyText="Проектов нет"
          items={projects.map(p => ({
            ...p,
            meta: p.prod != null && <Badge className="ml-auto shrink-0">prod №{p.prod}</Badge>,
            actions: (
              <IconButton
                icon={X}
                size="xs"
                variant="danger"
                label={`Убрать «${p.label}»`}
                onClick={() => setProjects(list => list.filter(x => x.value !== p.value))}
              />
            ),
          }))}
        />
        <PickerSelect aria-label="Схема" placeholder="Сначала проект" className="w-56" disabled value={null} onValueChange={() => {}} items={[]} />
      </Demo>
      <Demo label="MultiSelect">
        <MultiSelect
          className="w-64"
          options={SAMPLE_OPTIONS.map(o => ({value: o.value, label: String(o.label)}))}
          selected={multi}
          onChange={setMulti}
          placeholder="Режимы"
          icon={<Tag size={14} />}
        />
      </Demo>
    </>
  );
}
