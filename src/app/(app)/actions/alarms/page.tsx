"use client";

import dynamic from "next/dynamic";

const AlarmsLog = dynamic(() => import("./AlarmsLogClient"), {
  ssr: false,
});

export default function Page() {
  return <AlarmsLog />;
}
