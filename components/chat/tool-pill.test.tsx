/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { ToolPill } from "./tool-pill";
import type { ToolCall } from "./types";

function makeTool(overrides: Partial<ToolCall> = {}): ToolCall {
  return { name: "log_consumption_batch", state: "ok", ...overrides };
}

describe("ToolPill", () => {
  it("labels a batch call with its item count (plural)", () => {
    render(<ToolPill tool={makeTool({ itemCount: 2 })} />);
    expect(screen.getByText("Log Consumption (2 items)")).toBeInTheDocument();
    expect(screen.queryByText("Log Consumption Batch")).toBeNull();
  });

  it("uses the singular noun for a single item", () => {
    render(<ToolPill tool={makeTool({ itemCount: 1 })} />);
    expect(screen.getByText("Log Consumption (1 item)")).toBeInTheDocument();
  });

  it("drops the parenthetical when the batch has no item count", () => {
    render(<ToolPill tool={makeTool()} />);
    expect(screen.getByText("Log Consumption")).toBeInTheDocument();
    expect(screen.queryByText(/items?\)/)).toBeNull();
  });

  it("humanizes a non-batch tool name", () => {
    render(<ToolPill tool={{ name: "list_exercises", state: "ok" }} />);
    expect(screen.getByText("List Exercises")).toBeInTheDocument();
  });

  it("shows the count label while the batch is running", () => {
    render(<ToolPill tool={makeTool({ itemCount: 2, state: "running" })} />);
    expect(screen.getByText("Calling Log Consumption (2 items)…")).toBeInTheDocument();
  });
});
