"use client";

import React from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {guardedClick} from "@/lib/unsavedGuard";

/** Логотип в шапке — тоже переход между разделами, поэтому спрашивает о несохранённом. */
export default function LogoLink({href, className, label, children}: {
  href: string;
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link href={href} className={className} aria-label={label} onClick={guardedClick(() => router.push(href))}>
      {children}
    </Link>
  );
}
