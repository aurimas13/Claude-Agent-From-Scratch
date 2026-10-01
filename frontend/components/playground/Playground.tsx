"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Brain, Calculator, Clock3, CloudSun, Eye, Globe, MessageSquarePlus, Sparkles, Wrench, Zap } from "lucide-react";
import { ApiError, applyEvent, fetchConversation, fetchStats, storedToTurn, streamChat } from "@/lib/api";
import type { Turn } from "@/lib/types";
import { Composer } from "./Composer";
import { QuickTools } from "./QuickTools";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import { TurnView } from "./TurnView";

const STORAGE_KEY = "afs.conversation";

const EXAMPLES = [
  { icon: Calculator, tint: "text-emerald-600 bg-emerald-50", text: "I invest $10,000 at 7% a year. How much after 10 years?" },
  { icon: CloudSun, tint: "text-sky-600 bg-sky-50", text: "Do I need an umbrella in London tomorrow?" },
  { icon: Clock3, tint: "text-amber-600 bg-amber-50", text: "If it's 9:00 in Vilnius, what time is it in San Francisco?" },
  { icon: Globe, tint: "text-indigo-600 bg-indigo-50", text: "What is the ReAct pattern for AI agents? Keep it short." },
];

const LOOP = [
  { icon: Brain, label: "Think", tint: "bg-brand-50 text-brand-700 ring-brand-200" },
  { icon: Wrench, label: "Act", tint: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { icon: Eye, label: "Observe", tint: "bg-sky-50 text-sky-700 ring-sky-200" },
  { icon: Sparkles, label: "Answer", tint: "bg-amber-50 text-amber-700 ring-amber-200" },
];

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStoredId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) - memory still works for this tab */
  }
}

export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ questions_today: number; answered_from_cache: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  // Restore the previous conversation (memory lives in the database, keyed by this id).
  useEffect(() => {
    const id = readStoredId();
    fetchStats().then(setStats);
    if (!id) return;
    fetchConversation(id).then((stored) => {
      if (!stored) return writeStoredId(null);
      setConversationId(id);
      setTurns(stored.map(storedToTurn));
    });
  }, []);

  const updateTurn = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const send = useCallback(
    async (message: string) => {
      if (busy) return;
      const id = crypto.randomUUID();
      setTurns((all) => [...all, { id, question: message, segments: [], status: "thinking" }]);
      setBusy(true);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamChat(
          { message, conversation_id: conversationId, turnstile_token: conversationId ? null : turnstile.current?.token() },
          (event) => {
            if (event.type === "meta") {
              setConversationId(event.conversation_id);
              writeStoredId(event.conversation_id);
            } else if (event.type === "done") {
              updateTurn(id, (t) => ({ ...t, status: "done", cached: event.cached, iterations: event.iterations, usage: event.usage }));
            } else if (event.type === "error") {
              updateTurn(id, (t) => ({ ...t, status: "error", error: event.message }));
            } else {
              updateTurn(id, (t) => ({ ...t, status: "streaming", segments: applyEvent(t.segments, event) }));
            }
          },
          controller.signal,
        );
      } catch (err) {
        const aborted = controller.signal.aborted;
        const message =
          err instanceof ApiError ? err.message : aborted ? "Stopped." : "Couldn't reach the agent. Is the backend running?";
        updateTurn(id, (t) => ({ ...t, status: aborted ? "done" : "error", error: aborted ? undefined : message }));
        if (err instanceof ApiError && err.status === 404) {
          setConversationId(null);
          writeStoredId(null);
        }
      } finally {
        turnstile.current?.reset();
        abortRef.current = null;
        setBusy(false);
        updateTurn(id, (t) => (t.status === "thinking" || t.status === "streaming" ? { ...t, status: "done" } : t));
        fetchStats().then(setStats);
      }
    },
    [busy, conversationId, updateTurn],
  );

  const newChat = () => {
    abortRef.current?.abort();
    setTurns([]);
    setConversationId(null);
    writeStoredId(null);
  };

  const empty = turns.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className={`mx-auto max-w-3xl text-center ${empty ? "" : "lg:mx-0 lg:max-w-none lg:text-left"}`}>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm">
          <Sparkles className="size-3.5" aria-hidden /> A ReAct agent built from scratch on the Claude API
        </p>
        <h1 className={`mt-4 font-semibold tracking-tight text-ink ${empty ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>
          Ask. Watch it think.{" "}
          <span className="bg-gradient-to-r from-brand-600 via-sky-500 to-amber-500 bg-clip-text text-transparent">Get the answer.</span>
        </h1>
        {empty && (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Do maths, check the weather, or find the time anywhere in the world. Every step the agent takes appears below as it happens.
          </p>
        )}
        <ol className={`mt-5 flex flex-wrap items-center gap-2 ${empty ? "justify-center" : "justify-center lg:justify-start"}`} aria-label="The agent loop">
          {LOOP.map(({ icon: Icon, label, tint }, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tint}`}>
                <Icon className="size-3.5" aria-hidden /> {label}
              </span>
              {i < LOOP.length - 1 && <ArrowRight className="size-3.5 text-slate-300" aria-hidden />}
            </li>
          ))}
          <li>
            <Link href="/how-it-works" className="ml-1 text-xs font-medium text-brand-600 underline-offset-2 hover:underline">
              What does this mean?
            </Link>
          </li>
        </ol>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Conversation" className="min-w-0">
          {empty ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXAMPLES.map(({ icon: Icon, tint, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => send(text)}
                  disabled={busy}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tint}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-[15px] text-slate-700 group-hover:text-ink">{text}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {turns.length} {turns.length === 1 ? "question" : "questions"} · the agent remembers this chat
                </p>
                <button
                  type="button"
                  onClick={newChat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-ink"
                >
                  <MessageSquarePlus className="size-4" aria-hidden /> New chat
                </button>
              </div>
              {turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} />
              ))}
            </div>
          )}

          <div ref={bottomRef} className={`z-10 mt-6 space-y-2 ${empty ? "" : "sticky bottom-4"}`}>
            <Turnstile ref={turnstile} />
            <Composer busy={busy} onSend={send} onStop={() => abortRef.current?.abort()} />
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <QuickTools ask={send} busy={busy} />
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm">
            <p className="font-semibold">What&apos;s different about an agent?</p>
            <p className="mt-1 text-slate-600">
              A chatbot only talks. An agent can <strong className="font-medium text-ink">use tools</strong>: it decides it needs the calculator,
              uses it, reads the result, and then answers.
            </p>
            <Link href="/how-it-works" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Explained like you&apos;re five <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {stats && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm">
              <Zap className="size-5 text-amber-500" aria-hidden />
              <p className="text-slate-600">
                <span className="font-semibold text-ink">{stats.questions_today}</span> {stats.questions_today === 1 ? "question" : "questions"} today ·{" "}
                <span className="font-semibold text-ink">{stats.answered_from_cache}</span> answered instantly from the database cache
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
