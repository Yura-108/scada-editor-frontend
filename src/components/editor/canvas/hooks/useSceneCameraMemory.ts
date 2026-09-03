"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import { resolveSheet } from "@/lib/editor/sheet";
import { cameraForSheet } from "@/lib/editor/fitCamera";
import { CameraScope, readSceneCamera, writeSceneCamera } from "@/lib/editor/sceneCamera";

/** Задержка отложенной записи — как у раскладки редактора (WorkSpace). */
const SAVE_DELAY = 300;

/**
 * Каждая сцена помнит своё положение камеры.
 *
 * Раньше камера была общей на всё приложение и её никто не сбрасывал: уехал в угол схемы
 * A, переключился на B — B открывалась под координатами и масштабом A. Теперь камера
 * запоминается по сцене, а сцена, открытая впервые, показывается вписанной по листу.
 *
 * Монтируется по одному разу на страницу: `"editor"` рядом с холстом редактора,
 * `"monitor"` — в мониторе (у них общий стор, но раздельная память вида).
 */
export function useSceneCameraMemory(scope: CameraScope) {
  const sceneId = useEditorStore(s => s.scene?.id ?? null);
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const canvasRect = useEditorStore(s => s.canvasRect);
  const elements = useEditorStore(s => s.elements);
  const setCamera = useEditorStore(s => s.setCamera);

  /** Ключ сцены, для которой камера уже восстановлена. */
  const restoredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (sceneId == null) {
      restoredKeyRef.current = null;
      return;
    }

    const key = `${scope}:${projectId ?? "-"}:${sceneId}`;
    // Восстанавливаем ровно один раз на сцену. Это же условие делает безопасной
    // перезагрузку ТОЙ ЖЕ сцены после сохранения и после восстановления версии
    // (loadScene с keepHistory): id не меняется — вид не дёргается на автосохранении.
    if (restoredKeyRef.current === key) return;

    const saved = readSceneCamera(scope, projectId, sceneId);
    if (saved) {
      restoredKeyRef.current = key;
      setCamera(saved.x, saved.y, saved.zoom);
      return;
    }

    // Запомненной камеры нет — показываем лист целиком. Прямоугольник холста приезжает
    // асинхронно (ResizeObserver + rAF в useCanvasRect), поэтому пока его нет, ключ
    // НЕ помечаем восстановленным: эффект перезапустится, когда размер появится.
    if (!canvasRect) return;

    restoredKeyRef.current = key;
    const cam = cameraForSheet(resolveSheet(elements), canvasRect);
    setCamera(cam.x, cam.y, cam.zoom);
  }, [scope, projectId, sceneId, canvasRect, elements, setCamera]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: (() => void) | null = null;

    // Подписка, а не эффект по `camera`: пан пишет камеру на КАЖДОЕ движение мыши, а
    // Ctrl+колесо — дважды на тик. Синхронная запись в localStorage оттуда недопустима.
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.camera === prev.camera) return;

      // Ключ и камера захватываются СЕЙЧАС, а не читаются в момент срабатывания:
      // иначе отложенная запись, начатая в одной сцене, легла бы под ключ другой.
      const sid = state.scene?.id ?? null;
      if (sid == null) return;
      const pid = state.currentProject?.id ?? null;
      const camera = state.camera;

      pending = () => writeSceneCamera(scope, pid, sid, camera);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const write = pending;
        pending = null;
        write?.();
      }, SAVE_DELAY);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      // Дописываем отложенное: иначе последний пан перед уходом со страницы теряется.
      pending?.();
    };
  }, [scope]);
}
