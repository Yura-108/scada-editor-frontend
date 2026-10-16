import {useEffect} from "react";
import {Client, type StompSubscription} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {devLog} from "@/lib/devLog";
import {gatewayHttpOrigin} from "@/lib/gatewayOrigin";
import {useEditorStore} from "@/store/useEditorStore";
import {useSceneChangeStore} from "@/store/useSceneChangeStore";

const log = (...args: unknown[]) => devLog("[editor:ws]", ...args);

const RECONNECT_DELAY_MS = 5000;

/** Тело сообщения на `/topic/scenes/{sceneId}`. */
interface SceneChangedMessage {
  type?: string;
  scene_id?: number;
  version_no?: number;
  user_name?: string;
}

/**
 * Уведомления «сцену сохранил другой инженер» (`SCENE_CHANGED`, backend `editor` с 25.09.2026).
 *
 * Отдельный STOMP-клиент на `/ws/editor` через gateway; токен — cookie `access_token`
 * (`withCredentials`), как у остальных подключений. Подписан только на ОТКРЫТУЮ в редакторе
 * сцену: при смене сцены старая подписка снимается. После переподключения подписки STOMP не
 * живут, поэтому `onConnect` подписывается заново.
 *
 * Монтировать ОДИН раз — в странице редактора. Решение, показывать ли сообщение (своё
 * сохранение, уже догнанная версия), принимает `visibleSceneChange`, а не этот хук.
 */
export function useSceneChangedNotifications() {
  useEffect(() => {
    let subscription: StompSubscription | null = null;
    let subscribedSceneId: number | null = null;

    const currentSceneId = (): number | null => {
      const {scene, sceneSource} = useEditorStore.getState();
      if (sceneSource !== "draft" || scene?.id == null) return null;
      const id = Number(scene.id);
      return Number.isFinite(id) ? id : null;
    };

    const client = new Client({
      // Фабрика зовётся в браузере при activate()/переподключении — адрес из страницы.
      webSocketFactory: () =>
        new SockJS(`${gatewayHttpOrigin()}/ws/editor`, null, {withCredentials: true} as never),
      reconnectDelay: RECONNECT_DELAY_MS,
    });

    const resubscribe = () => {
      const sceneId = currentSceneId();
      if (sceneId === subscribedSceneId && subscription) return;

      // Без соединения unsubscribe бросает исключение, а подписка и так уже мертва.
      if (client.connected) subscription?.unsubscribe();
      subscription = null;
      subscribedSceneId = null;
      if (sceneId == null || !client.connected) return;

      log(`подписка на сцену ${sceneId}`);
      subscribedSceneId = sceneId;
      subscription = client.subscribe(`/topic/scenes/${sceneId}`, frame => {
        let msg: SceneChangedMessage;
        try {
          msg = JSON.parse(frame.body);
        } catch {
          return;
        }
        if (msg.type !== "SCENE_CHANGED" || typeof msg.version_no !== "number") return;
        log("SCENE_CHANGED", msg);
        useSceneChangeStore.getState().receive({
          sceneId: typeof msg.scene_id === "number" ? msg.scene_id : sceneId,
          versionNo: msg.version_no,
          userName: msg.user_name ?? "",
        });
      });
    };

    client.onConnect = () => {
      log("соединение установлено");
      // Подписка прошлого соединения умерла вместе с ним.
      subscription = null;
      subscribedSceneId = null;
      resubscribe();
    };
    client.onStompError = frame => log("ошибка STOMP:", frame.headers.message);

    client.activate();
    const unsubscribeStore = useEditorStore.subscribe((s, prev) => {
      if (s.scene?.id !== prev.scene?.id || s.sceneSource !== prev.sceneSource) resubscribe();
    });

    return () => {
      unsubscribeStore();
      if (client.connected) subscription?.unsubscribe();
      void client.deactivate();
    };
  }, []);
}
