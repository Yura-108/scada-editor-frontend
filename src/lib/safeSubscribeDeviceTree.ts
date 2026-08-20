import { wsClient } from "@/shared/websocket/wsClient";
import { subscribeDeviceTree } from "@/shared/websocket/wsSubscriptions";

export function safeSubscribeDeviceTree(site: string, project: string) {
  return new Promise<void>((resolve) => {
    const doSubscribe = () => {
      subscribeDeviceTree(site, project);
      resolve();
    };

    if (wsClient.active) {
      doSubscribe();
    } else {
      wsClient.onConnect = () => {
        doSubscribe();
      };
      wsClient.activate();
    }
  });
}
