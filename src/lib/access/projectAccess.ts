import type {ProjectGrant} from "@/types/access.types";
import {grantOf} from "@/lib/access/grants";
import {useEditorStore} from "@/store/useEditorStore";
import {useSessionUserStore} from "@/store/useSessionUserStore";

export * from "@/lib/access/grants";

/** Права в текущем проекте редактора/монитора (реактивно). */
export const useCurrentProjectGrant = (): ProjectGrant => {
  const admin = useSessionUserStore(s => s.admin);
  const project = useEditorStore(s => s.currentProject);
  const fromList = useEditorStore(s =>
    s.currentProject ? s.projectList.find(p => p.id === s.currentProject!.id) : undefined,
  );
  return grantOf(fromList ?? project, admin);
};

/** То же вне React — для гардов в сторе и движке монитора. */
export const getCurrentProjectGrant = (): ProjectGrant => {
  const {currentProject, projectList} = useEditorStore.getState();
  const fromList = currentProject ? projectList.find(p => p.id === currentProject.id) : undefined;
  return grantOf(fromList ?? currentProject, useSessionUserStore.getState().admin);
};
