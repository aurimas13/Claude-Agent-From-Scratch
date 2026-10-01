"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export const MAX_CHARS = 1500;

export function Composer({
  busy,
  onSend,
  onStop,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100"
    >
      <label htmlFor="composer" className="sr-only">
        Ask the agent
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_CHARS}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask anything: “What’s 18% tip on €64.50?”, “Weather in Tokyo?”, “Time in New York?”"
        className="block max-h-[180px] w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-slate-400"
      />
      <div className="flex items-center justify-between px-2 pb-1">
        <span className={`text-xs ${value.length > MAX_CHARS * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
          {value.length > 0 ? `${value.length}/${MAX_CHARS}` : "Enter to send · Shift+Enter for a new line"}
        </span>
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            <Square className="size-3.5 fill-current" aria-hidden /> Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
