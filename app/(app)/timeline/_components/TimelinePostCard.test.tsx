/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { TimelineAuthor, TimelinePost } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The card composes ReactionBar (toast), CommentThread (profile + fetch), and
// WorkoutTimelineSummary (workout fetch). Stub them to trivial nodes so this
// test stays focused on the author header. Avatar + SOURCE_META are pure and
// render for real.
vi.mock("./ReactionBar", () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));
vi.mock("./CommentThread", () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));
vi.mock("./WorkoutTimelineSummary", () => ({
  WorkoutTimelineSummary: () => <div data-testid="workout-summary" />,
}));

import { TimelinePostCard } from "./TimelinePostCard";

function author(overrides: Partial<TimelineAuthor> = {}): TimelineAuthor {
  return {
    user_id: "u_sam",
    username: "sam",
    display_name: "Sam Lifter",
    avatar_url: null,
    ...overrides,
  };
}

function post(overrides: Partial<TimelinePost> = {}): TimelinePost {
  return {
    id: "p1",
    source_type: "workout",
    source_id: "w1",
    occurred_at: "2026-06-10T12:00:00Z",
    visibility: "private",
    author: author(),
    content: { title: "Leg Day", subtitle: "", metrics: [], href: "/workouts/w1" },
    reactions: { summary: {}, mine: [] },
    comment_count: 0,
    ...overrides,
  };
}

describe("TimelinePostCard", () => {
  it("renders the author's display name linked to their profile", () => {
    render(<TimelinePostCard post={post()} exercises={[]} />);

    const link = screen.getByRole("link", { name: "Sam Lifter" });
    expect(link).toHaveAttribute("href", "/u/sam");
  });

  it("keeps the source label + emoji as a secondary line", () => {
    render(<TimelinePostCard post={post()} exercises={[]} />);

    // The source-type meta (label) still shows beneath the author identity.
    expect(screen.getByText("Workout")).toBeInTheDocument();
  });

  it("renders the author name as plain text (no link) when username is null", () => {
    render(<TimelinePostCard post={post({ author: author({ username: null }) })} exercises={[]} />);

    expect(screen.getByText("Sam Lifter")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sam Lifter" })).not.toBeInTheDocument();
  });
});
