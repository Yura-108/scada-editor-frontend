"use client";

import dynamic from "next/dynamic";

const Automation = dynamic(() => import("./AutomationClient"), {ssr: false});

export default function Page() {
  return <Automation />;
}
