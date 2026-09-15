"use client";

import dynamic from "next/dynamic";

const ProjectData = dynamic(() => import("./DataClient"), {ssr: false});

export default function Page() {
  return <ProjectData />;
}
