import './globals.css';
import { Inter } from 'next/font/google';
import Providers from './providers';
import {WebSocketProvider} from "@/providers/WebSocketProvider";
import React from "react";
import {ModalRoot} from "@/components/ui/ModalRoot";
import {Cpu, HashIcon, Layout, Settings} from "lucide-react";
import Link from "next/link";
import {cn} from "@/lib/utils";
import LogoutButton from "@/components/ui/LogoutButton";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // @ts-ignore
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>
          <WebSocketProvider>
            <header className="sticky top-0 z-50 w-full border-b border-gray-800/60 bg-gray-900/70 backdrop-blur-md">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Cpu className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-gray-400">
              SCADA
            </span>
                </div>

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
                  <Link
                    href="/channels"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      "text-gray-400 hover:text-white hover:bg-white/5 active:scale-95"
                    )}
                  >
                    <HashIcon className="w-4 h-4" />
                    База каналов
                  </Link>
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
            {children}
            <ModalRoot />
          </WebSocketProvider>
        </Providers>
      </body>
    </html>
  );
}
