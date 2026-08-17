"use client";

import dynamic from "next/dynamic";

const Monitor = dynamic(() => import("./MonitorClient"), {
  ssr: false,
});

export default function Page() {
  return <Monitor />;
}
