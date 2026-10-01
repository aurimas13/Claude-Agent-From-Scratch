"use client";

import { useState } from "react";
import { Check, Copy, FileCode, NotebookText, SquareTerminal } from "lucide-react";

const WHERE = {
  terminal: { label: "Terminal", icon: SquareTerminal, tint: "bg-slate-900 text-white" },
  file: { label: "Code file", icon: FileCode, tint: "bg-brand-600 text-white" },
  notebook: { label: "Notebook cell", icon: NotebookText, tint: "bg-amber-500 text-white" },
} as const;

export type Where = keyof typeof WHERE;

export function WhereBadge({ where }: { where: Where }) {
  const w = WHERE[where];
  const Icon = w.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${w.tint}`}>
      <Icon className="size-3" aria-hidden /> {w.label}
    </span>
  );
}

export function CodeBlock({ code, where = "terminal", path }: { code: string; where?: Where; path?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8fc]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
        <WhereBadge where={where} />
        {path && <span className="truncate font-mono text-xs text-slate-500">{path}</span>}
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-ink"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}
