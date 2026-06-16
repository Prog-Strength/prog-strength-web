import type { ContentBlock } from "@/lib/agent";

export type ToolCall = { name: string; state: "running" | "ok" | "error" };

export type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  tools?: ToolCall[];
  model?: string;
};
