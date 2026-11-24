"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {fetchCatalogProjects, fetchCatalogSites, fetchCatalogSubtree} from "../api/catalogApi";
import {ancestorsOf, toCatalogNode, type CatalogNode} from "../lib/branchPaths";

export type PathStatus = "ok" | "missing" | "unknown";

const depthOf = (key: string) => key.split(".").length;

/**
 * База каналов для выбора веток, подгружаемая по раскрытию: площадки сразу, проекты площадки —
 * при её раскрытии, всё поддерево проекта — одним запросом при раскрытии проекта. Грузить
 * каталог целиком заранее незачем: веток обычно единицы, а узлов тысячи.
 *
 * `loaded` — узлы, дети которых уже известны (их `rc-tree` больше не подгружает). По нему же
 * видно, можно ли сказать «такого пути нет»: только когда известны дети его родителя.
 */
export function useCatalogTree() {
  const [nodes, setNodes] = useState<Map<string, CatalogNode>>(() => new Map());
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const inflight = useRef(new Map<string, Promise<void>>());

  const merge = useCallback((keys: string[], loadedKeys: string[]) => {
    setNodes(prev => {
      const next = new Map(prev);
      for (const key of keys) {
        for (const k of [...ancestorsOf(key), key]) if (!next.has(k)) next.set(k, toCatalogNode(k));
      }
      return next;
    });
    setLoaded(prev => new Set([...prev, ...loadedKeys]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogSites()
      .then(sites => {
        if (cancelled) return;
        merge([...sites].sort((a, b) => a.localeCompare(b, "ru")), []);
        setSitesLoaded(true);
      })
      .catch(err => !cancelled && toast.error((err as Error).message));
    return () => { cancelled = true; };
  }, [merge]);

  /** Подгрузить детей узла: площадки — её проекты, проекта — всё его поддерево. */
  const loadChildren = useCallback((key: string): Promise<void> => {
    const running = inflight.current.get(key);
    if (running) return running;
    const depth = depthOf(key);
    const job = (async () => {
      try {
        if (depth === 1) {
          const projects = await fetchCatalogProjects(key);
          merge([...projects].sort((a, b) => a.localeCompare(b, "ru")), [key]);
        } else {
          // Проект (или глубже — тогда грузим его проект): поддерево приходит целиком,
          // и детей знаем у всех его узлов сразу.
          const project = key.split(".").slice(0, 2).join(".");
          const keys = await fetchCatalogSubtree(project);
          merge(keys, [project, ...keys]);
        }
      } catch (err) {
        inflight.current.delete(key);
        toast.error((err as Error).message);
      }
    })();
    inflight.current.set(key, job);
    return job;
  }, [merge]);

  /** Подгрузить всё, что нужно, чтобы проверить пути сохранённых веток. */
  const ensurePaths = useCallback(async (paths: string[]) => {
    const containers = new Set<string>();
    for (const path of paths) {
      const parts = path.split(".");
      if (parts.length >= 2) containers.add(parts[0]);
      if (parts.length >= 3) containers.add(parts.slice(0, 2).join("."));
    }
    // Сначала площадки, потом проекты: проект без загруженной площадки не проверить.
    const sorted = [...containers].sort((a, b) => depthOf(a) - depthOf(b));
    await Promise.all(sorted.filter(k => depthOf(k) === 1).map(loadChildren));
    await Promise.all(sorted.filter(k => depthOf(k) === 2).map(loadChildren));
  }, [loadChildren]);

  /** Есть ли путь в базе каналов. `unknown` — родитель ещё не подгружен. */
  const statusOf = useCallback((path: string): PathStatus => {
    for (const p of [...ancestorsOf(path), path]) {
      if (nodes.has(p)) continue;
      const parent = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
      const parentKnown = parent ? loaded.has(parent) : sitesLoaded;
      return parentKnown ? "missing" : "unknown";
    }
    return "ok";
  }, [nodes, loaded, sitesLoaded]);

  return {nodes, loaded, sitesLoaded, loadChildren, ensurePaths, statusOf};
}

export type CatalogTree = ReturnType<typeof useCatalogTree>;
