/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactionSummary } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const addReactionMock = vi.hoisted(() => vi.fn());
const removeReactionMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  addTimelineReaction: addReactionMock,
  removeTimelineReaction: removeReactionMock,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorToastMock, info: vi.fn(), dismiss: vi.fn() }),
}));

import { ReactionBar } from "./ReactionBar";

beforeEach(() => {
  vi.clearAllMocks();
});

function emptyReactions(): ReactionSummary {
  return { summary: {}, mine: [] };
}

describe("ReactionBar", () => {
  it("optimistically adds a count + active state and calls the api with the type", async () => {
    // PUT echoes the server-authoritative summary.
    addReactionMock.mockResolvedValue({ summary: { fire: 1 }, mine: ["fire"] });
    render(<ReactionBar postId="p1" reactions={emptyReactions()} />);

    const fire = screen.getByRole("button", { name: "Fire" });
    expect(fire).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(fire);

    // Optimistic: pressed + count shows immediately (before the promise settles).
    expect(fire).toHaveAttribute("aria-pressed", "true");
    expect(fire).toHaveTextContent("1");
    expect(addReactionMock).toHaveBeenCalledWith("test-token", "p1", "fire");

    // Reconciles to the server summary without changing the visible state.
    await waitFor(() => expect(fire).toHaveAttribute("aria-pressed", "true"));
    expect(fire).toHaveTextContent("1");
  });

  it("optimistically removes a reaction the viewer already applied", async () => {
    removeReactionMock.mockResolvedValue(undefined);
    render(<ReactionBar postId="p1" reactions={{ summary: { like: 3 }, mine: ["like"] }} />);

    const like = screen.getByRole("button", { name: "Like" });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveTextContent("3");

    fireEvent.click(like);

    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(like).toHaveTextContent("2");
    expect(removeReactionMock).toHaveBeenCalledWith("test-token", "p1", "like");

    // Let the trailing in-flight cleanup (the `finally` setState) settle so
    // the post-click state update is flushed inside act().
    await waitFor(() => expect(removeReactionMock).toHaveBeenCalledTimes(1));
  });

  it("composes two different reaction types toggled back-to-back while both api calls are in flight", async () => {
    // Hold both PUTs open so they overlap (both pending in the same frame),
    // then resolve each with its server-authoritative echo. Each echo is
    // post-wide, so resolving the second reflects BOTH types being active.
    let resolveLike!: (v: ReactionSummary) => void;
    let resolveStrong!: (v: ReactionSummary) => void;
    addReactionMock.mockImplementation((_t: string, _p: string, type: string) =>
      type === "like"
        ? new Promise<ReactionSummary>((res) => {
            resolveLike = res;
          })
        : new Promise<ReactionSummary>((res) => {
            resolveStrong = res;
          }),
    );

    render(<ReactionBar postId="p1" reactions={emptyReactions()} />);
    const like = screen.getByRole("button", { name: "Like" });
    const strong = screen.getByRole("button", { name: "Strong" });

    // Two DIFFERENT types clicked back-to-back; both requests now in flight.
    fireEvent.click(like);
    fireEvent.click(strong);

    // Optimistic state of BOTH composes — the second click must not clobber
    // the first type's optimistic update.
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveTextContent("1");
    expect(strong).toHaveAttribute("aria-pressed", "true");
    expect(strong).toHaveTextContent("1");

    // Resolve both PUTs (server echo reflects both reactions for the post).
    resolveLike({ summary: { like: 1, strong: 1 }, mine: ["like", "strong"] });
    resolveStrong({ summary: { like: 1, strong: 1 }, mine: ["like", "strong"] });

    // Both end up active with correct counts.
    await waitFor(() => expect(strong).toHaveAttribute("aria-pressed", "true"));
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveTextContent("1");
    expect(strong).toHaveTextContent("1");
  });

  it("a failed toggle of one type does not discard a concurrent toggle of another type", async () => {
    // Like will reject; Strong stays in flight (still pending, optimistic).
    // The Like rollback must revert ONLY Like via a functional re-toggle,
    // leaving Strong's concurrent optimistic update intact — the exact
    // clobber the stale-snapshot rollback used to cause.
    let rejectLike!: (e: Error) => void;
    addReactionMock.mockImplementation((_t: string, _p: string, type: string) =>
      type === "like"
        ? new Promise<ReactionSummary>((_res, rej) => {
            rejectLike = rej;
          })
        : // Strong: never settles within the test → stays optimistic.
          new Promise<ReactionSummary>(() => {}),
    );

    render(<ReactionBar postId="p1" reactions={emptyReactions()} />);
    const like = screen.getByRole("button", { name: "Like" });
    const strong = screen.getByRole("button", { name: "Strong" });

    fireEvent.click(like);
    fireEvent.click(strong);

    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(strong).toHaveAttribute("aria-pressed", "true");

    rejectLike(new Error("network down"));

    // Like rolled back; Strong's concurrent optimistic update untouched.
    await waitFor(() => expect(like).toHaveAttribute("aria-pressed", "false"));
    expect(like).not.toHaveTextContent("1");
    expect(strong).toHaveAttribute("aria-pressed", "true");
    expect(strong).toHaveTextContent("1");
    expect(errorToastMock).toHaveBeenCalledWith("network down");
  });

  it("rolls back the optimistic add and surfaces a toast when the api rejects", async () => {
    addReactionMock.mockRejectedValue(new Error("network down"));
    render(<ReactionBar postId="p1" reactions={emptyReactions()} />);

    const strong = screen.getByRole("button", { name: "Strong" });
    fireEvent.click(strong);

    // Optimistic on first paint.
    expect(strong).toHaveAttribute("aria-pressed", "true");

    // Rolled back after rejection.
    await waitFor(() => expect(strong).toHaveAttribute("aria-pressed", "false"));
    expect(strong).not.toHaveTextContent("1");
    expect(errorToastMock).toHaveBeenCalledWith("network down");
  });
});
