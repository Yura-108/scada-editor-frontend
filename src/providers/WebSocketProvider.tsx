"use client";

import React, { useEffect } from "react";
import { wsClient } from "@/shared/websocket/wsClient";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    wsClient.activate();

    return () => {
      void wsClient.deactivate();
    };
  }, []);

  return <>{children}</>;
}
