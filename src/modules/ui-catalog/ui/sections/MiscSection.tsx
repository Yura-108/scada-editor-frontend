"use client";

import React, {useState} from "react";
import {Badge} from "@/shared/ui/Badge";
import {Button} from "@/shared/ui/Button";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {VersionHistoryList} from "@/shared/ui/VersionHistoryList";
import {Collapsible} from "@/shared/ui/codeModalParts";
import {CatalogSection, Demo} from "../CatalogSection";
import {SAMPLE_VERSIONS} from "../../lib/sampleData";

export function MiscSection() {
  return (
    <CatalogSection
      id="misc"
      title="Прочее"
      description="История версий документа; плашка несохранённых правок и справка раздела — они висят в углу окна, поэтому показываются по кнопке."
    >
      <Misc />
    </CatalogSection>
  );
}

function Misc() {
  const [dirty, setDirty] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [help, setHelp] = useState(false);

  return (
    <>
      <Demo label="VersionHistoryList" className="block space-y-2">
        <Button size="sm" onClick={() => setDirty(d => !d)}>{dirty ? "Без правок" : "Есть несохранённые правки"}</Button>
        <VersionHistoryList versions={SAMPLE_VERSIONS} currentVersion={5} dirty={dirty} onRestore={() => {}} />
      </Demo>
      <Demo label="UnsavedNotice и FloatingHelp (в углу окна)">
        <Button size="sm" onClick={() => setUnsaved(v => !v)}>{unsaved ? "Скрыть" : "Показать"} UnsavedNotice</Button>
        <Button size="sm" onClick={() => setHelp(v => !v)}>{help ? "Скрыть" : "Показать"} FloatingHelp</Button>
        {unsaved && (
          <UnsavedNotice details="таблицы: 2" onSave={() => setUnsaved(false)} onDiscard={() => setUnsaved(false)} />
        )}
        {help && (
          <FloatingHelp storageKey="help.ui-catalog" title="Справка раздела">
            <p className="text-sm">Инструкция к разделу. Свёрнута или развёрнута — помнит браузер.</p>
          </FloatingHelp>
        )}
      </Demo>
      <Demo label="Collapsible (окна редакторов кода)" className="block">
        <Collapsible title="Доступные переменные" badge={<Badge>3</Badge>}>
          <p className="px-3 py-2 text-sm text-muted-foreground">value, prev, tag</p>
        </Collapsible>
      </Demo>
    </>
  );
}
