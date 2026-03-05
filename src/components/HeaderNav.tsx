"use client";

import React from "react";
import Link from "next/link";
import {cn} from "@/lib/utils";
import {HashIcon, Layout} from "lucide-react";
import {usePathname} from "next/navigation";

const navItems = [
  {
    name: "Редактор схем",
    href: "/editor",
    icon: Layout,
  },
  {
    name: "База каналов",
    href: "/channels",
    icon: HashIcon,
  },
];

export default function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1">
      {navItems.map((item, index) => {
        const isActive = pathname === item.href;

        return (
          <React.Fragment key={item.href + index}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                "active:scale-95",
                isActive
                  ? "text-white bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-indigo-400" : "text-current"
              )} />
              {item.name}
            </Link>

            {index < navItems.length - 1 && (
              <div className="w-px h-4 bg-gray-800 mx-2" />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}