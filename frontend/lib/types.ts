export type ToolName = "calculator" | "get_weather" | "get_world_time" | "save_note" | "web_search" | string;

export type AgentEvent =
  | { type: "meta"; conversation_id: string }
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: ToolName; input: Record<string, unknown>; server: boolean }
  | { type: "tool_result"; id: string; name: ToolName; output: string; is_error: boolean; ms: number | null }
  | {
      type: "done";
      cached: boolean;
      stop_reason: string;
      iterations?: number;
      tools_used?: string[];
      usage?: { input_tokens: number; output_tokens: number; web_searches: number };
    }
  | { type: "error"; message: string };

export type TextSegment = { kind: "text"; text: string };
export type ToolSegment = {
  kind: "tool";
  id: string;
  name: ToolName;
  input: Record<string, unknown>;
  server: boolean;
  output?: string;
  isError?: boolean;
  ms?: number | null;
};
export type Segment = TextSegment | ToolSegment;

export type Turn = {
  id: string;
  question: string;
  segments: Segment[];
  status: "thinking" | "streaming" | "done" | "error";
  cached?: boolean;
  error?: string;
  iterations?: number;
  usage?: { input_tokens: number; output_tokens: number };
};

export type StoredTurn = {
  question: string;
  answer: string;
  cached: boolean;
  trace: Array<
    | { type: "text"; text: string }
    | Extract<AgentEvent, { type: "tool_call" }>
    | Extract<AgentEvent, { type: "tool_result" }>
  >;
};
