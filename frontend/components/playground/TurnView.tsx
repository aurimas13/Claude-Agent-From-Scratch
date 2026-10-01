"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Brain, ChevronDown, Eye, LoaderCircle, Sparkles, Zap } from "lucide-react";
import { describeInput, toolMeta } from "@/lib/tools";
import type { Segment, ToolSegment, Turn } from "@/lib/types";
import { ToolResult } from "./ToolResult";

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function splitSegments(segments: Segment[]) {
  let lastTool = -1;
  segments.forEach((s, i) => {
    if (s.kind === "tool") lastTool = i;
  });
  const steps = segments.slice(0, lastTool + 1).filter((s) => s.kind === "tool" || s.text.trim());
  return { steps, answer: segments.slice(lastTool + 1) };
}

function ToolStep({ segment, index }: { segment: ToolSegment; index: number }) {
  const meta = toolMeta(segment.name);
  const Icon = meta.icon;
  const pending = segment.output === undefined;
  const detail = describeInput(segment.name, segment.input);
  return (
    <li className="relative animate-rise pl-9">
      <span className={`absolute left-0 top-0 grid size-7 place-items-center rounded-full ring-1 ${meta.tint}`}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Step {index} · Act
      </p>
      <p className="mt-0.5 text-sm text-slate-700">
        <span className="font-medium">{meta.label}</span>
        {detail && (
          <>
            {" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{detail}</code>
          </>
        )}
        {segment.server && <span className="ml-1.5 text-xs text-slate-400">(runs on Anthropic&apos;s servers)</span>}
      </p>
      <div className="mt-2">
        {pending ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> {meta.verb}…
          </p>
        ) : (
          <>
            <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Eye className="size-3" aria-hidden /> Observe{segment.ms ? ` · ${segment.ms} ms` : ""}
            </p>
            <ToolResult segment={segment} />
          </>
        )}
      </div>
    </li>
  );
}

function ThinkStep({ text, index }: { text: string; index: number }) {
  if (!text.trim()) return null;
  return (
    <li className="relative animate-rise pl-9">
      <span className="absolute left-0 top-0 grid size-7 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-200">
        <Brain className="size-3.5" aria-hidden />
      </span>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Step {index} · Think</p>
      <p className="mt-0.5 text-sm italic text-slate-600">{text.trim()}</p>
    </li>
  );
}

export function TurnView({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(true);
  const { steps, answer } = splitSegments(turn.segments);
  const answerText = answer.map((s) => (s.kind === "text" ? s.text : "")).join("");
  const toolCount = steps.filter((s) => s.kind === "tool").length;
  const live = turn.status === "thinking" || turn.status === "streaming";

  return (
    <article className="space-y-3 animate-rise">
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] text-white shadow-sm shadow-brand-600/20">
          {turn.question}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-sky-400 text-white">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="text-sm font-medium">Agent</span>
          {turn.cached && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <Zap className="size-3" aria-hidden /> Instant answer from database cache
            </span>
          )}
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-500" /> working
            </span>
          )}
        </div>

        {steps.length > 0 && (
          <div className="mb-4 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700"
            >
              <span>
                How I got there <span className="font-normal text-slate-500">· {toolCount} tool {toolCount === 1 ? "call" : "calls"}</span>
              </span>
              <ChevronDown className={`size-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open && (
              <ol className="mt-3 space-y-4 border-l border-dashed border-slate-200 pl-0 [&>li]:-ml-px">
                {steps.map((s, i) =>
                  s.kind === "tool" ? <ToolStep key={s.id} segment={s} index={i + 1} /> : <ThinkStep key={`t${i}`} text={s.text} index={i + 1} />,
                )}
              </ol>
            )}
          </div>
        )}

        <div aria-live="polite">
          {turn.status === "thinking" && !answerText && steps.length === 0 && (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Thinking…
            </p>
          )}
          {answerText && (
            <div className="text-[15px] text-slate-800">
              {steps.length > 0 && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Answer</p>}
              <Markdown text={answerText} />
              {live && !answerText.includes("\n") && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-blink bg-brand-500 align-middle" aria-hidden />
              )}
            </div>
          )}
          {turn.status === "error" && (
            <p className="mt-2 inline-flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {turn.error}
            </p>
          )}
        </div>

        {turn.status === "done" && (turn.iterations || turn.usage) && (
          <p className="mt-3 text-xs text-slate-400">
            {turn.iterations} model {turn.iterations === 1 ? "call" : "calls"}
            {turn.usage ? ` · ${turn.usage.input_tokens.toLocaleString()} in / ${turn.usage.output_tokens.toLocaleString()} out tokens` : ""}
          </p>
        )}
      </div>
    </article>
  );
}
