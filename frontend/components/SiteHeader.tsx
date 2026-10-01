"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { REPO_URL } from "@/lib/api";

const NAV = [
  { href: "/", label: "Playground" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/run-it-yourself", label: "Run it yourself" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-sm shadow-brand-500/30">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">Agent From Scratch</span>
        </Link>
        <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto text-[13px] sm:gap-1 sm:text-sm" aria-label="Main">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 transition sm:px-3 ${
                  active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm transition hover:border-slate-300 sm:inline-flex"
          >
            GitHub <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </nav>
      </div>
    </header>
  );
}
