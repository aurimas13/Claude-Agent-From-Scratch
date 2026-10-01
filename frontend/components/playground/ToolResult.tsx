"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Download,
  Droplets,
  ExternalLink,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { safeJson } from "@/lib/tools";
import type { ToolSegment } from "@/lib/types";

type Weather = {
  location: string;
  current: {
    condition: string;
    icon: string;
    temperature_c: number;
    feels_like_c: number;
    humidity_pct: number;
    wind_kmh: number;
  };
  forecast: { date: string; condition: string; icon: string; max_c: number; min_c: number; rain_chance_pct: number | null }[];
};
type WorldTime = { location: string; timezone: string; local_time: string; local_date: string; utc_offset: string; abbreviation: string };
type Search = { results?: { title: string; url: string }[] };

const WEATHER_ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function weekday(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en", { weekday: "short" });
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function downloadNote(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "note"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ToolResult({ segment }: { segment: ToolSegment }) {
  const { name, output, isError, input } = segment;
  if (output === undefined) return null;

  if (isError) {
    return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{output.replace(/^Error:\s*/, "")}</p>;
  }

  if (name === "calculator") {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-white px-3 py-2 font-mono text-sm ring-1 ring-emerald-200">
        <span className="text-slate-500">{String(input.expression ?? "")}</span>
        <span className="text-slate-400">=</span>
        <span className="text-base font-semibold text-emerald-700">{output}</span>
      </div>
    );
  }

  if (name === "get_weather") {
    const w = safeJson<Weather>(output);
    if (!w) return null;
    const Icon = WEATHER_ICONS[w.current.icon] ?? Cloud;
    return (
      <div className="rounded-xl bg-gradient-to-br from-sky-50 to-white p-3 ring-1 ring-sky-200">
        <div className="flex items-center gap-3">
          <Icon className="size-10 shrink-0 text-sky-500" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{w.location}</p>
            <p className="text-2xl font-semibold tracking-tight">
              {Math.round(w.current.temperature_c)}°C <span className="text-sm font-normal text-slate-500">{w.current.condition}</span>
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><Thermometer className="size-3.5" aria-hidden /> feels {Math.round(w.current.feels_like_c)}°</span>
          <span className="inline-flex items-center gap-1"><Droplets className="size-3.5" aria-hidden /> {w.current.humidity_pct}%</span>
          <span className="inline-flex items-center gap-1"><Wind className="size-3.5" aria-hidden /> {Math.round(w.current.wind_kmh)} km/h</span>
        </div>
        {w.forecast.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {w.forecast.slice(0, 4).map((day) => {
              const DayIcon = WEATHER_ICONS[day.icon] ?? Cloud;
              return (
                <div key={day.date} className="rounded-lg bg-white/80 px-2 py-1.5 text-center text-xs ring-1 ring-sky-100">
                  <p className="font-medium text-slate-600">{weekday(day.date)}</p>
                  <DayIcon className="mx-auto my-0.5 size-4 text-sky-500" aria-label={day.condition} />
                  <p>
                    <span className="font-semibold">{Math.round(day.max_c)}°</span> <span className="text-slate-400">{Math.round(day.min_c)}°</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (name === "get_world_time") {
    const t = safeJson<WorldTime>(output);
    if (!t) return null;
    return (
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-amber-50 to-white p-3 ring-1 ring-amber-200">
        <p className="font-mono text-3xl font-semibold tracking-tight text-amber-700">{t.local_time}</p>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-700">{t.location}</p>
          <p className="text-slate-500">
            {t.local_date} · UTC{t.utc_offset}
          </p>
        </div>
      </div>
    );
  }

  if (name === "web_search") {
    const s = safeJson<Search>(output);
    const results = s?.results ?? [];
    if (!results.length) return <p className="text-sm text-slate-500">No results.</p>;
    return (
      <ul className="space-y-1">
        {results.slice(0, 4).map((r) => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1.5 text-sm text-slate-700 hover:text-indigo-700">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-indigo-400" aria-hidden />
              <span className="line-clamp-1">
                {r.title} <span className="text-xs text-slate-400">{hostname(r.url)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (name === "save_note") {
    const title = String(input.title ?? "note");
    const content = String(input.content ?? "");
    return (
      <button
        type="button"
        onClick={() => downloadNote(title, content)}
        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50"
      >
        <Download className="size-4" aria-hidden /> Download “{title}”
      </button>
    );
  }

  return <pre className="overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs">{output}</pre>;
}
