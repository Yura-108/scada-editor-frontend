import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export const wsClient = new Client({
  webSocketFactory: () =>
    new SockJS("http://localhost:8080/ws", null, {
      withCredentials: true,
    } as any),
  reconnectDelay: 5000,
  debug: () => {},
});
