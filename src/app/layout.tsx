import './globals.css';
import { Inter } from 'next/font/google';
import Providers from './providers';
import {WebSocketProvider} from "@/providers/WebSocketProvider";
import React from "react";
import {ModalRoot} from "@/components/ui/ModalRoot";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers>
          <WebSocketProvider>
            {children}
            <ModalRoot />
          </WebSocketProvider>
        </Providers>
      </body>
    </html>
  );
}
