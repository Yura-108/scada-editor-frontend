"use client";

import dynamic from "next/dynamic";

const Actions = dynamic(() => import("./ActionsClient"), {
  ssr: false,
});

export default function Page() {
  return <Actions />;
}
