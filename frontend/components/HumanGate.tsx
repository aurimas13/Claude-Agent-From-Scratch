"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { getSession, startSession } from "@/lib/api";
import { TURNSTILE_SITE_KEY, Turnstile } from "./Turnstile";

type GateState = "checking" | "challenge" | "verifying" | "ready" | "offline" | "failed";

const GateContext = createContext<{ reverify: () => void }>({ reverify: () => {} });

/** Ask for a fresh human check, e.g. when the API answers 401 because the 12-hour session ended. */
export const useHumanGate = () => useContext(GateContext);

/**
 * Shows a one-time "are you human?" screen before the site, powered by Cloudflare Turnstile.
 * The API turns the Turnstile token into a signed, HttpOnly 12-hour session cookie, so visitors
 * are checked once per visit, not once per question.
 */
export function HumanGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const verify = useCallback(async (token: string | null) => {
    setState("verifying");
    try {
      await startSession(token);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setState("failed");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled) return;
        if (session.verified) setState("ready");
        else if (!session.turnstile_required) void verify(null); // local dev: no bot check configured
        else if (!TURNSTILE_SITE_KEY) {
          setError("The bot check isn't configured on this site (missing site key).");
          setState("failed");
        } else setState("challenge");
      })
      .catch(() => !cancelled && setState("offline")); // API down: still let people read the site
    return () => {
      cancelled = true;
    };
  }, [verify]);

  const reverify = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
    setState("challenge");
  }, []);

  if (state === "ready" || state === "offline") {
    return (
      <GateContext.Provider value={{ reverify }}>
        {state === "offline" && (
          <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            The live agent is offline right now. You can still explore how it works.
          </div>
        )}
        {children}
      </GateContext.Provider>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <section aria-labelledby="gate-title" className="w-full max-w-md animate-rise rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-brand-600/5">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-400 text-white shadow-md shadow-brand-500/30">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <h1 id="gate-title" className="mt-5 text-2xl font-semibold tracking-tight">
          Quick check before we start
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          This free demo runs a real, paid AI model, so it makes sure you&apos;re a person, not a bot. It usually takes a second
          and lasts for 12 hours.
        </p>

        <div className="mt-6 min-h-[72px]" aria-live="polite">
          {state === "checking" && (
            <p className="inline-flex items-center gap-2 pt-5 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Getting things ready…
            </p>
          )}
          {state === "challenge" && (
            <Turnstile
              key={attempt}
              onToken={(token) => void verify(token)}
              onError={() => {
                setError("The check couldn't complete. Please try again.");
                setState("failed");
              }}
            />
          )}
          {state === "verifying" && (
            <p className="inline-flex items-center gap-2 pt-5 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Verified. Opening the agent…
            </p>
          )}
          {state === "failed" && (
            <div className="space-y-3 pt-2">
              <p className="inline-flex items-start gap-2 text-left text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
              <button
                type="button"
                onClick={reverify}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                <RotateCcw className="size-4" aria-hidden /> Try again
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" aria-hidden /> Protected by Cloudflare Turnstile · valid for 12 hours
        </p>
      </section>
    </div>
  );
}
