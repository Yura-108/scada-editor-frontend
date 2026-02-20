"use client";

import { useState } from "react";
import {paletteItems} from "@/constants/palette";
import PaletteItem from "./PaletteItem";

export default function Palette() {
  const [search, setSearch] = useState("");

  const filtered = paletteItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()),
  )

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof filtered>);

  return (
    <div className="w-64 bg-[#111] text-white p-3 rounded">
      <input
        className="w-full mb-3 px-2 py-1 bg-[#222] rounded"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-4">
          <div  className="text-xs text-gray-400 mb-2 uppercase">
            {category}
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <PaletteItem key={item.type} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

