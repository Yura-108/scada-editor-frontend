"use client";

import React from "react";
import {VersionHistoryList} from "@/core/project";
import type {useTablesDocument} from "../model/useTablesDocument";
import type {useVariablesDocument} from "../model/useVariablesDocument";
import type {DataTab} from "./dataHelp";
import {DataVersionChanges} from "./DataVersionChanges";
import {TablesEditor} from "./TablesEditor";
import {VariablesEditor} from "./VariablesEditor";

/** Содержимое вкладки «Данных», когда документ вкладки загружен. */
export function DataTabContent({tab, projectId, canWrite, tables, variables}: {
  tab: DataTab;
  projectId: number;
  canWrite: boolean;
  tables: ReturnType<typeof useTablesDocument>;
  variables: ReturnType<typeof useVariablesDocument>;
}) {
  if (tab === "tables") {
    return (
      <TablesEditor
        tables={tables.data!.tables}
        errors={tables.errors}
        onChange={tables.edit}
        onInvalidCountChange={tables.setInvalidCells}
        selected={tables.selectedTable}
        onSelect={tables.setSelectedTable}
        readOnly={!canWrite}
      />
    );
  }
  if (tab === "variables") {
    return (
      <fieldset disabled={!canWrite} className="flex-1 min-h-0 min-w-0 m-0 p-0 border-0 overflow-y-auto pb-24">
        <VariablesEditor
          variables={variables.automation!.variables}
          tasks={variables.automation!.tasks}
          errors={variables.errors.filter(e => e.field.startsWith("variables"))}
          onChange={variables.edit}
        />
      </fieldset>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-24">
      <VersionHistoryList
        versions={tables.versions}
        currentVersion={tables.data!.version}
        dirty={tables.dirty}
        onRestore={canWrite ? v => void tables.restore(v) : undefined}
        renderDetails={(v, previous) => (
          <DataVersionChanges
            projectId={projectId}
            versionNo={v.version_no}
            previousNo={previous?.version_no ?? (v.version_no > 1 ? v.version_no - 1 : null)}
          />
        )}
      />
    </div>
  );
}
