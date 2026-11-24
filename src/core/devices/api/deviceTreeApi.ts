import type {NodeParamType, NodeType} from "../types/channelsTypes";
import {fetchFullHierarchy, fetchSiteHierarchy} from "./devicesApi";

/**
 * Дерево базы каналов для выбранных проектов: узлы и параметры одним результатом.
 *
 * Собирается из нескольких запросов — `fullHierarchy` по каждому проекту и `hierarchy` по
 * площадкам (собственные параметры проектов), пустые проекты достраиваются. Ошибка любого
 * запроса по проекту — исключение; параметры площадок необязательны и молча пропускаются.
 */
export async function fetchDeviceTree(rootPath: string[]): Promise<{nodes: NodeType[]; params: NodeParamType[]}> {
  const results = await Promise.all(rootPath.map(fetchFullHierarchy));

  const allRawNodes: { key: string }[] = [];
  const allParams: NodeParamType[] = [];

  results.forEach(res => {
    allRawNodes.push(...res.nodes);
    allParams.push(...res.params);
  });

  const processedNodes = allRawNodes.map(n => {
    const parts = n.key.split('.');
    const title = parts.pop() || '';
    const parentKey = parts.join('.');

    return {
      ...n,
      title,
      parentKey
    };
  });

  // Гарантируем, что выбранные проекты присутствуют в дереве, даже если они пустые —
  // чтобы пустой проект всё равно отображался и в него можно было добавлять узлы.
  const existingKeys = new Set(processedNodes.map((n) => n.key));
  rootPath.forEach((projectKey) => {
    if (existingKeys.has(projectKey)) return;
    const parts = projectKey.split('.');
    const title = parts.pop() || '';
    const parentKey = parts.join('.');
    processedNodes.push({key: projectKey, title, parentKey});
  });

  // Собственные параметры узла проекта fullHierarchy не отдаёт: его запрос — строго
  // `id_node LIKE 'root.%'`, то есть только потомки, сам корень в выдачу не попадает
  // (NodeRepository.findByIdNodeStartingWith). Добираем их по площадке через
  // `hierarchy` (прямые дети, ~2 КБ на площадку) — иначе у проекта не видно ни
  // «Источника импорта», ни любого другого его собственного параметра.
  const sites = Array.from(
    new Set(rootPath.map((p) => p.split('.')[0]).filter(Boolean)),
  );
  const siteParams: NodeParamType[] = [];
  await Promise.all(sites.map(async (site) => {
    try {
      const json = await fetchSiteHierarchy(site);
      if (!json) return;
      // Берём только выбранные проекты: у площадки в ответе есть и соседние,
      // а их узлов в дереве нет.
      siteParams.push(...(json.params ?? []).filter((p) => rootPath.includes(p.parentKey)));
    } catch {
      // Данные необязательные: дерево уже загружено, молча обходимся без них.
    }
  }));

  const uniqueParams = Array.from(
    new Map([...allParams, ...siteParams].map(p => [p.key, p])).values(),
  );

  return {nodes: processedNodes, params: uniqueParams};
}
