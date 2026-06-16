import { CheckIcon, DotsIcon, XIcon } from "./icons";
import type { ToolCall } from "./types";

/**
 * Persistent indicator that the agent invoked a tool. Each pill shows
 * the tool's humanized name and its state — running (animated dots),
 * ok (check), or error (red x). Stays on the message after the turn
 * completes so the user can scroll back and see which tools answered
 * which prompt.
 */
export function ToolPill({ tool }: { tool: ToolCall }) {
  const name = humanizeToolName(tool.name);
  if (tool.state === "running") {
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
        <DotsIcon />
        <span>Calling {name}…</span>
      </span>
    );
  }
  if (tool.state === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
        <CheckIcon />
        <span>{name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
      <XIcon />
      <span>{name} failed</span>
    </span>
  );
}

/**
 * Display form for the agent's tool names. The MCP tools are snake_case
 * ("list_exercises"); Title Case reads more naturally to the user
 * ("List Exercises") without losing the operation's identity.
 */
function humanizeToolName(name: string): string {
  return name
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}
