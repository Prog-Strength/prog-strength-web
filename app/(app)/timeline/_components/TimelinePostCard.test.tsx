/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { TimelineAuthor, TimelinePost } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The card composes ReactionBar (toast), CommentThread (profile + fetch), and
// WorkoutTimelineSummary (workout fetch). Stub them to trivial nodes so this
// test stays focused on the card composition. Avatar + SOURCE_META + StatRow
// are pure and render for real.
vi.mock("./ReactionBar", () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));
vi.mock("./CommentThread", () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));
vi.mock("./WorkoutTimelineSummary", () => ({
  WorkoutTimelineSummary: () => <div data-testid="workout-summary" />,
}));
// RouteMap fetches nothing but renders an SVG slot; stub to a testid so the
// run-only slot can be asserted directly.
vi.mock("./RouteMap", () => ({
  RouteMap: () => <div data-testid="route-map" />,
}));
// The viewer's resolved profile drives the "You" badge.
vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({ profile: { id: "u_me" } }),
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
    source_type: "activity",
    activity_type: "strength_training",
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

  it("shows a You badge on the viewer's own post", () => {
    render(
      <TimelinePostCard post={post({ author: author({ user_id: "u_me" }) })} exercises={[]} />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not show a You badge on another athlete's post", () => {
    render(<TimelinePostCard post={post()} exercises={[]} />);
    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("shows a milestone banner for PRs", () => {
    render(<TimelinePostCard post={post({ source_type: "pr" })} exercises={[]} />);
    // The label appears in both the banner and the source-meta line, so the
    // banner's presence is the second occurrence beyond the meta line.
    expect(screen.getAllByText(/personal record/i).length).toBeGreaterThan(1);
  });

  it("shows a milestone banner for best efforts", () => {
    render(<TimelinePostCard post={post({ source_type: "best_effort" })} exercises={[]} />);
    expect(screen.getAllByText(/best effort/i).length).toBeGreaterThan(1);
  });

  it("does not show a milestone banner for session posts", () => {
    render(<TimelinePostCard post={post()} exercises={[]} />);
    expect(screen.queryByText(/personal record/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/best effort/i)).not.toBeInTheDocument();
  });

  // The two sport-specific slots key off activity_type, not source_type —
  // every session shares the one `activity` source type now.
  it("renders the route map slot for runs only", () => {
    const { rerender } = render(
      <TimelinePostCard post={post({ activity_type: "running" })} exercises={[]} />,
    );
    expect(screen.getByTestId("route-map")).toBeInTheDocument();
    rerender(<TimelinePostCard post={post({ activity_type: "hiking" })} exercises={[]} />);
    expect(screen.queryByTestId("route-map")).not.toBeInTheDocument();
  });

  it("renders the workout summary for strength posts only", () => {
    const { rerender } = render(<TimelinePostCard post={post()} exercises={[]} />);
    expect(screen.getByTestId("workout-summary")).toBeInTheDocument();
    rerender(<TimelinePostCard post={post({ activity_type: "hiking" })} exercises={[]} />);
    expect(screen.queryByTestId("workout-summary")).not.toBeInTheDocument();
  });

  it("labels a hike with its own glyph and label", () => {
    render(
      <TimelinePostCard
        post={post({
          activity_type: "hiking",
          content: {
            title: "Franconia Ridge",
            subtitle: "",
            metrics: [],
            href: "/activities?view=hiking",
          },
        })}
        exercises={[]}
      />,
    );
    expect(screen.getByText("Hike")).toBeInTheDocument();
  });

  // The API's type registry can add a sport without a web deploy, so an
  // activity_type this build has never seen must still render a usable card.
  it("falls back to a generic Activity label for an unknown sport", () => {
    render(
      <TimelinePostCard
        post={post({
          activity_type: "kickboxing",
          content: { title: "Sparring", subtitle: "", metrics: [], href: "/activities" },
        })}
        exercises={[]}
      />,
    );
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Sparring")).toBeInTheDocument();
    expect(screen.queryByTestId("workout-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("route-map")).not.toBeInTheDocument();
  });

  it("renders big-value stats from content.metrics", () => {
    render(
      <TimelinePostCard
        post={post({
          activity_type: "running",
          content: { title: "Run", subtitle: "", metrics: ["5.0 mi · 41:12"], href: "/running/r1" },
        })}
        exercises={[]}
      />,
    );
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("mi")).toBeInTheDocument();
  });
});
