import type { AgentEvent, Segment, StoredTurn, Turn } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/aurimas13/Claude-Agent-From-Scratch";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** POST /api/chat and call onEvent for every Server-Sent Event the agent streams back. */
export async function streamChat(
  body: { message: string; conversation_id?: string | null; turnstile_token?: string | null },
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* not JSON */
    }
    throw new ApiError(detail, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)) as AgentEvent);
      }
    }
  }
}

export async function fetchConversation(id: string): Promise<StoredTurn[] | null> {
  const response = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { turns: StoredTurn[] };
  return data.turns;
}

export async function fetchStats(): Promise<{ questions_today: number; answered_from_cache: number } | null> {
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** Fold one streamed event into a turn's ordered list of segments. */
export function applyEvent(segments: Segment[], event: AgentEvent): Segment[] {
  switch (event.type) {
    case "text": {
      const last = segments[segments.length - 1];
      if (last?.kind === "text") return [...segments.slice(0, -1), { kind: "text", text: last.text + event.delta }];
      return [...segments, { kind: "text", text: event.delta }];
    }
    case "tool_call":
      return [...segments, { kind: "tool", id: event.id, name: event.name, input: event.input, server: event.server }];
    case "tool_result":
      return segments.map((s) =>
        s.kind === "tool" && s.id === event.id ? { ...s, output: event.output, isError: event.is_error, ms: event.ms } : s,
      );
    default:
      return segments;
  }
}

export function storedToTurn(stored: StoredTurn, index: number): Turn {
  let segments: Segment[] = [];
  for (const item of stored.trace) {
    segments = applyEvent(segments, item.type === "text" ? { type: "text", delta: item.text } : item);
  }
  return { id: `stored-${index}`, question: stored.question, segments, status: "done", cached: stored.cached };
}
