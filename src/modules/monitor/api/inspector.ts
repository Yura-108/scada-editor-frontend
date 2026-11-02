import type {InspectorObjectDto} from "@/core/runtime";

/**
 * Объекты prod-выпуска со свойствами для инспектора
 * (docs/contract/2026-10-01-object-inspector-contract.md).
 */
export async function fetchInspectorObjects(projectId: number, signal: AbortSignal) {
  const res = await fetch(`/api/runtime/projects/${projectId}/objects`, {signal});
  if (res.status === 409) {
    // Состояние, а не сбой: проект не исполняется — объектов выпуска нет.
    const body = await res.json().catch(() => null) as {message?: string} | null;
    throw new Error(body?.message || "Проект не в эксплуатации — объекты выпуска недоступны");
  }
  if (!res.ok) throw new Error(`Список объектов не загружен (${res.status})`);
  const list = await res.json().catch(() => []);
  return Array.isArray(list) ? list as InspectorObjectDto[] : [];
}
