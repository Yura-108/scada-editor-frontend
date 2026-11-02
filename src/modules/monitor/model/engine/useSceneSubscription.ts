import {useEffect, type RefObject} from "react";
import {devLog} from "@/shared/lib/devLog";
import type {RuntimeMode} from "./useRuntimeEngine";
import type {RuntimeConnection} from "./runtimeConnection";
import {dropTags, setsEqual, type EngineBuffers} from "./engineBuffers";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/** Последняя подписка на сцену, о которой знает runtime (см. `useRuntimeEngine`). */
export type SceneSubscription = {sceneId: number; tags: ReadonlySet<string>; wire: string[]};

interface Params {
  active: boolean;
  mode: RuntimeMode;
  sceneId: number | null;
  sceneTags: string[];
  extraTags: readonly string[];
  buffers: EngineBuffers;
  connRef: RefObject<RuntimeConnection | null>;
  lastSubRef: RefObject<SceneSubscription | null>;
}

/**
 * Подписка WS на открытую сцену (контракты 2026-10-08-ws-scene-subscription-contract.md и
 * 2026-10-09-ws-scene-subscription-tags-fix.md).
 *
 * В `tags` уходят ТОЛЬКО теги панелей вне сцены (runtimeTagInterest) за вычетом тегов схемы.
 * Теги сцены runtime находит сам — свойства и прямые привязки, в т.ч. примитивов `composition`.
 * Сессии одной сцены без `tags` делят один кадр UPDATE, сериализуемый один раз на всех; непустой
 * `tags` делает набор сессии уникальным, и кадр собирается для неё отдельно. Поэтому тег сцены,
 * замерший без `tags`, — ошибка индекса runtime, а не повод дописать его сюда.
 *
 * Локально же сравнение «изменилась ли подписка» и сброс значений идут по полному набору.
 *
 * Объявлен РАНЬШЕ повторного прогона при смене схемы: сброс значений обязан случиться до того,
 * как прогон прочитает valuesRef и посчитает «нет данных».
 */
export function useSceneSubscription({active, mode, sceneId, sceneTags, extraTags, buffers, connRef, lastSubRef}: Params) {
  useEffect(() => {
    if (!active || mode !== "live" || sceneId == null || !Number.isFinite(sceneId)) return;
    const next = new Set<string>(sceneTags);
    for (const t of extraTags) next.add(t);
    const prev = lastSubRef.current;
    if (prev && prev.sceneId === sceneId && setsEqual(prev.tags, next)) return;

    // Тег, выпавший из подписки, больше не обновляется — его значение устареет, а схема с ним
    // уверенно показывала бы то, чего уже нет. Держим только теги, которые были в подписке И
    // остаются в ней: значение, пришедшее «вдогонку» после ухода со сцены, тоже устарело бы.
    // Новые теги ждут немедленного UPDATE от runtime (до него — оверлей «нет данных»), и flush
    // прогонит их биндинги: значения в valuesRef нет, no-op-страж изменение не отсечёт.
    const keep = (tag: string) => next.has(tag) && (!prev || prev.tags.has(tag));
    const dropped = dropTags(buffers, keep);

    const onScene = new Set(sceneTags);
    const wire = extraTags.filter(t => !onScene.has(t));
    lastSubRef.current = {sceneId, tags: next, wire};
    // До открытия соединения connRef пуст — подписку отправит эффект соединения.
    connRef.current?.subscribeScene(sceneId, wire);
    log(`подписка на сцену ${sceneId}: тегов схемы ${sceneTags.length}, вне схемы ${wire.length}, сброшено значений ${dropped}`);
  }, [active, mode, sceneId, sceneTags, extraTags, buffers, connRef, lastSubRef]);
}
