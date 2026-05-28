import './globals.css';
import {Inter} from 'next/font/google';
import Providers from './providers';
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ThemeProvider } from "next-themes";
import {WebSocketProvider} from "@/providers/WebSocketProvider";
import React from "react";
import {ModalRoot} from "@/components/ui/ModalRoot";
import {Cpu, Settings} from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";
import {getUser} from "@/lib/getUser";
import HeaderNav from "@/components/editor/HeaderNav";

const inter = Inter({subsets: ['latin']});

export default async function RootLayout({children}: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <html lang="ru" suppressHydrationWarning>
    <body className={inter.className}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Providers>
      <WebSocketProvider>
        <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800/60 bg-white dark:bg-gray-900/70 backdrop-blur-md">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">

            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Cpu className="w-5 h-5 text-gray-900 dark:text-white"/>
              </div>
              <span
                className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-gray-400">
              SCADA
            </span>
            </div>

            <HeaderNav/>

            {/* Правая часть: Кнопки действий */}
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-colors">
                <Settings className="w-5 h-5"/>
              </button>
              {user && (
                <>
                  <div className="h-8 w-px bg-gray-100 dark:bg-gray-800"/>
                  <LogoutButton/>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
        <ModalRoot/>
      </WebSocketProvider>
    </Providers>
      </ThemeProvider>
    </body>
    </html>
  );
}


