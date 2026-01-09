import { wsClient } from "./wsClient";
import { useDeviceStore } from "@/store/useDeviceStore";
import type { StompSubscription } from "@stomp/stompjs";

type WSEvent =
  | { type: "DEVICE_CREATED"; payload: { node: any; params: any[] } }
  | { type: "DEVICE_REMOVED"; payload: { key: string } }
  | { type: "PARAM_CREATED"; payload: any }
  | { type: "PARAM_UPDATED"; payload: { key: string; value: string } }
  | { type: "PARAM_REMOVED"; payload: { key: string } };

// 🔐 Храним активные подписки
const subscriptions = new Map<string, StompSubscription>();

function getDestination(site: string, project: string) {
  return `/topic/device-tree/${site}/${project}`;
}

export function subscribeDeviceTree(site: string, project: string) {
  const destination = getDestination(site, project);

  // ❗ защита от двойной подписки
  if (subscriptions.has(destination)) return;

  const sub = wsClient.subscribe(destination, (msg) => {
    const event: WSEvent = JSON.parse(msg.body);

    useDeviceStore.setState((state) => {
      switch (event.type) {
        case "DEVICE_CREATED":
          return {
            nodes: [...state.nodes, event.payload.node],
            params: [...state.params, ...event.payload.params],
          };

        case "DEVICE_REMOVED":
          return {
            nodes: state.nodes.filter(n => n.key !== event.payload.key),
            params: state.params.filter(p => p.parentKey !== event.payload.key),
          };

        case "PARAM_CREATED":
          return {
            params: [...state.params, event.payload],
          };

        case "PARAM_UPDATED":
          return {
            params: state.params.map(p =>
              p.key === event.payload.key
                ? { ...p, value: event.payload.value }
                : p
            ),
          };

        case "PARAM_REMOVED":
          return {
            params: state.params.filter(p => p.key !== event.payload.key),
          };
      }
    });
  });

  subscriptions.set(destination, sub);
}

export function unsubscribeDeviceTree(site: string, project: string) {
  const destination = getDestination(site, project);

  const sub = subscriptions.get(destination);
  if (!sub) return;

  sub.unsubscribe();
  subscriptions.delete(destination);
}
