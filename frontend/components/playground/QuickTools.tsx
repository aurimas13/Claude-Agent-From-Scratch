"use client";

import { useState } from "react";
import { ArrowRight, Calculator, Clock3, CloudSun } from "lucide-react";

type Ask = (prompt: string) => void;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100";

function AskButton({ disabled, label = "Ask the agent" }: { disabled?: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
    >
      {label} <ArrowRight className="size-4" aria-hidden />
    </button>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const OPS = [
  { key: "+", label: "+", word: "plus" },
  { key: "-", label: "−", word: "minus" },
  { key: "*", label: "×", word: "times" },
  { key: "/", label: "÷", word: "divided by" },
  { key: "^", label: "xʸ", word: "to the power of" },
  { key: "%", label: "%", word: "percent of" },
] as const;

type CalcMode = "basic" | "interest" | "formula";

function CalculatorPanel({ ask, busy }: { ask: Ask; busy: boolean }) {
  const [mode, setMode] = useState<CalcMode>("basic");
  const [a, setA] = useState("1250");
  const [b, setB] = useState("8");
  const [op, setOp] = useState<(typeof OPS)[number]["key"]>("*");
  const [principal, setPrincipal] = useState("10000");
  const [rate, setRate] = useState("7");
  const [years, setYears] = useState("10");
  const [monthly, setMonthly] = useState(false);
  const [formula, setFormula] = useState("sqrt(144) * 366");

  const submit = () => {
    if (mode === "basic") {
      const o = OPS.find((x) => x.key === op)!;
      ask(op === "%" ? `What is ${a}% of ${b}?` : `Calculate ${a} ${o.label} ${b} (${a} ${o.word} ${b}).`);
    } else if (mode === "interest") {
      ask(
        `Calculate compound interest on ${principal} at ${rate}% per year for ${years} years, compounded ${
          monthly ? "monthly" : "yearly"
        }. Show the final amount and the interest earned, step by step.`,
      );
    } else {
      ask(`Calculate: ${formula}`);
    }
  };

  const valid =
    mode === "basic" ? a !== "" && b !== "" : mode === "interest" ? principal !== "" && rate !== "" && years !== "" : formula.trim() !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium" role="tablist" aria-label="Calculator mode">
        {(
          [
            ["basic", "Numbers"],
            ["interest", "Interest"],
            ["formula", "Formula"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={`rounded-lg py-1.5 transition ${mode === key ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "basic" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="First number" inputMode="decimal" className={inputClass} value={a} onChange={(e) => setA(e.target.value)} />
            <input aria-label="Second number" inputMode="decimal" className={inputClass} value={b} onChange={(e) => setB(e.target.value)} />
          </div>
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Operation">
            {OPS.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={op === o.key}
                aria-label={o.word}
                onClick={() => setOp(o.key)}
                className={`rounded-lg py-2 font-mono text-sm transition ${
                  op === o.key ? "bg-emerald-500 text-white shadow-sm" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "interest" && (
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
          <label className="space-y-1">
            Amount
            <input inputMode="decimal" className={inputClass} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </label>
          <label className="space-y-1">
            Rate %
            <input inputMode="decimal" className={inputClass} value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label className="space-y-1">
            Years
            <input inputMode="numeric" className={inputClass} value={years} onChange={(e) => setYears(e.target.value)} />
          </label>
          <label className="col-span-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="size-4 accent-brand-600" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} />
            Compound monthly
          </label>
        </div>
      )}

      {mode === "formula" && (
        <div className="space-y-2">
          <input aria-label="Formula" className={`${inputClass} font-mono`} value={formula} onChange={(e) => setFormula(e.target.value)} />
          <Chips items={["sqrt(144) * 366", "2^32", "factorial(10)", "round(pi * 7^2, 2)"]} onPick={setFormula} />
        </div>
      )}

      <AskButton disabled={busy || !valid} />
    </form>
  );
}

function PlacePanel({
  ask,
  busy,
  kind,
}: {
  ask: Ask;
  busy: boolean;
  kind: "weather" | "time";
}) {
  const [city, setCity] = useState(kind === "weather" ? "Vilnius" : "Tokyo");
  const [other, setOther] = useState("");
  const cities = kind === "weather" ? ["Vilnius", "Paris", "New York", "Tokyo", "Sydney"] : ["Tokyo", "New York", "London", "Sydney", "Vilnius"];

  const submit = () => {
    if (!city.trim()) return;
    if (kind === "weather") ask(`What's the weather in ${city.trim()} right now, and what's the forecast for the next 3 days?`);
    else if (other.trim()) {
      const second = other.trim().replace(/^compare (it )?with\s+/i, "");
      ask(`What time is it in ${city.trim()} and in ${second} right now? What's the time difference?`);
    }
    else ask(`What time is it in ${city.trim()} right now?`);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <input aria-label="City" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, e.g. Paris" maxLength={100} />
      {kind === "time" && (
        <input
          aria-label="Second city to compare (optional)"
          className={inputClass}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Second city to compare, e.g. Vilnius (optional)"
          maxLength={100}
        />
      )}
      <Chips items={cities} onPick={setCity} />
      <AskButton disabled={busy || !city.trim()} label={kind === "weather" ? "Get the weather" : "Get the time"} />
    </form>
  );
}

const TABS = [
  { key: "calc", label: "Calculator", icon: Calculator, color: "text-emerald-600" },
  { key: "weather", label: "Weather", icon: CloudSun, color: "text-sky-600" },
  { key: "time", label: "World clock", icon: Clock3, color: "text-amber-600" },
] as const;

export function QuickTools({ ask, busy }: { ask: Ask; busy: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("calc");
  return (
    <section aria-labelledby="quick-tools" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 id="quick-tools" className="text-sm font-semibold">
        Quick tools
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Fill in, and the agent works it out using its tools.</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Quick tools">
        {TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
              tab === key ? "border-brand-200 bg-brand-50 text-ink" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <Icon className={`size-4 ${color}`} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "calc" && <CalculatorPanel ask={ask} busy={busy} />}
        {tab === "weather" && <PlacePanel ask={ask} busy={busy} kind="weather" />}
        {tab === "time" && <PlacePanel ask={ask} busy={busy} kind="time" />}
      </div>
    </section>
  );
}
