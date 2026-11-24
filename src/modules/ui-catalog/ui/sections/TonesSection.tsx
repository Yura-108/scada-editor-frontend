"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {type Tone, toneStyles} from "@/shared/ui/tone";
import {CatalogSection} from "../CatalogSection";

const TONES: Tone[] = ["neutral", "primary", "success", "warning", "destructive", "info"];

export function TonesSection() {
  return (
    <CatalogSection
      id="tones"
      title="Тона"
      description="toneStyles из shared/ui/tone — статусные цвета Badge и Banner. Свой оттенок по месту не подбирать."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-medium">тон</th>
              <th className="px-1 font-medium">text</th>
              <th className="px-1 font-medium">soft</th>
              <th className="px-1 font-medium">strong</th>
              <th className="px-1 font-medium">tint</th>
            </tr>
          </thead>
          <tbody>
            {TONES.map(tone => {
              const s = toneStyles[tone];
              return (
                <tr key={tone}>
                  <td className="py-1 pr-2 font-mono">{tone}</td>
                  <td className={cn("px-1 font-medium", s.text)}>Текст</td>
                  <td className="px-1"><div className={cn("h-6 rounded-md border", s.soft, s.border)} /></td>
                  <td className="px-1"><div className={cn("h-6 rounded-md border", s.strong, s.border)} /></td>
                  <td className="px-1"><div className={cn("h-6 rounded-md border bg-card", s.tint, s.border)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CatalogSection>
  );
}
