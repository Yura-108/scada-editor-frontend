"use client";

import React, {useState} from "react";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {EditorStatusBadges} from "./EditorStatusBadges";
import {ProjectPicker} from "./ProjectPicker";
import {ScenePicker} from "./ScenePicker";

/**
 * Шапка редактора — такая же, как у остальных разделов: выбор проекта и схемы слева,
 * статусы справа. Открытием списков управляет она: после выбора проекта сразу
 * раскрывается выбор схемы.
 */
export function EditorHeader() {
  const [projectOpen, setProjectOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);

  return (
    <PageHeader title="Редактор" actions={<EditorStatusBadges />}>
      <ProjectPicker open={projectOpen} onOpenChange={setProjectOpen} onPicked={() => setSceneOpen(true)} />
      <ScenePicker open={sceneOpen} onOpenChange={setSceneOpen} />
    </PageHeader>
  );
}
