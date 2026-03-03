'use client';

import StartMenu from '@/components/StartMenu';
import LogoutButton from '@/components/ui/LogoutButton';
import DeviceTreePanel from '@/components/DeviceTreePanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import DeviceParams from '@/components/DeviceParams';
import Link from "next/link";
import { Layout, Settings, Cpu } from "lucide-react"; // Добавим иконки
import { cn } from "@/lib/utils";

export default function Workspace() {
  const { nodes } = useDeviceStore();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-gray-100">
      {/* --- СТИЛИЗОВАННЫЙ HEADER --- */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-800/60 bg-gray-900/70 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">

          {/* Левая часть: Лого или Название проекта */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              SCADA
            </span>
          </div>

          {/* Центральная часть: Навигация */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/editor"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                "text-gray-400 hover:text-white hover:bg-white/5 active:scale-95"
              )}
            >
              <Layout className="w-4 h-4" />
              Редактор схем
            </Link>
            <div className="w-px h-4 bg-gray-800 mx-2" />
            <button className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors">
              Документация
            </button>
          </nav>

          {/* Правая часть: Кнопки действий */}
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-gray-800" />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="container mx-auto flex flex-col md:flex-row justify-around pt-8 pb-20 gap-6 px-4">
        {nodes && (
          <aside className="transition-all duration-300 ease-in-out basis-full md:basis-[25%] lg:basis-[20%]">
            <DeviceTreePanel />
          </aside>
        )}
        <section className="transition-all duration-300 ease-in-out flex-1">
          <DeviceParams />
        </section>
      </main>

      <StartMenu />
    </div>
  );
}