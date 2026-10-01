import { Calculator, Clock3, CloudSun, Globe, NotebookPen, Wrench, type LucideIcon } from "lucide-react";

export type ToolMeta = {
  label: string;
  verb: string;
  icon: LucideIcon;
  /** Tailwind classes for the tinted chip / card */
  tint: string;
  dot: string;
};

export const TOOL_META: Record<string, ToolMeta> = {
  calculator: { label: "Calculator", verb: "Calculating", icon: Calculator, tint: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  get_weather: { label: "Weather", verb: "Checking the weather", icon: CloudSun, tint: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  get_world_time: { label: "World clock", verb: "Looking up the time", icon: Clock3, tint: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  web_search: { label: "Web search", verb: "Searching the web", icon: Globe, tint: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  save_note: { label: "Save note", verb: "Saving a note", icon: NotebookPen, tint: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export function toolMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? { label: name, verb: `Using ${name}`, icon: Wrench, tint: "bg-slate-50 text-slate-700 ring-slate-200", dot: "bg-slate-400" };
}

export function describeInput(name: string, input: Record<string, unknown>): string {
  const value = (key: string) => (typeof input[key] === "string" || typeof input[key] === "number" ? String(input[key]) : "");
  switch (name) {
    case "calculator":
      return value("expression");
    case "get_weather":
    case "get_world_time":
      return value("location");
    case "web_search":
      return value("query");
    case "save_note":
      return value("title");
    default:
      return JSON.stringify(input);
  }
}

export function safeJson<T>(text: string | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
