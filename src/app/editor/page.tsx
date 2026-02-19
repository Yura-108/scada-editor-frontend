"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("./EditorClient"), {
  ssr: false,
});

export default function Page() {
  return <Editor />;
}
