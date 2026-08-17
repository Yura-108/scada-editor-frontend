import React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // min-h-app, а не min-h-screen: под sticky-шапкой высотой --app-header-h
  // полный экран давал документ 100vh + 64px и вечную полосу прокрутки.
  return <div className="min-h-app bg-gray-50 dark:bg-neutral-950">{children}</div>;
}
