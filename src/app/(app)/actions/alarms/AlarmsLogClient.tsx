"use client";

import React, {useEffect} from "react";
import {AlarmLogView} from "@/modules/logs";
import {useEditorStore} from "@/modules/editor";
import {useSessionUserStore} from "@/store/useSessionUserStore";

/** Раздел «Аварии» журнала: список проектов и права — отсюда, журнал — из модуля logs. */
export default function AlarmsLogClient() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProjectId = useEditorStore(s => s.currentProject?.id ?? null);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const admin = useSessionUserStore(s => s.admin);
  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  return <AlarmLogView projects={projectList} admin={admin} currentProjectId={currentProjectId} />;
}
