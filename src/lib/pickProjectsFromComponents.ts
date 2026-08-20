export type EditorProject = {id: number; name: string};

export function normalizeProjectList(data: unknown): EditorProject[] {
  if (!Array.isArray(data)) return [];

  return data
    .map(toEditorProject)
    .filter((p): p is EditorProject => p !== null);
}

export function toEditorProject(component: unknown): EditorProject | null {
  if (!component || typeof component !== "object") return null;
  const c = component as {id?: number; name?: string};
  if (typeof c.id !== "number" || typeof c.name !== "string") return null;
  return {id: c.id, name: c.name};
}
