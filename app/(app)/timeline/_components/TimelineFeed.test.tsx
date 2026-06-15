/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TimelinePost } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const listTimelineMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  listTimeline: listTimelineMock,
}));

// TimelinePostCard pulls in ReactionBar (toast) + CommentThread (profile);
// stub them to a trivial node so this test stays focused on pagination.
vi.mock("./TimelinePostCard", () => ({
  TimelinePostCard: ({ post }: { post: TimelinePost }) => <div>{post.content.title}</div>,
}));

import { TimelineFeed } from "./TimelineFeed";

beforeEach(() => {
  vi.clearAllMocks();
});

function post(id: string, title: string): TimelinePost {
  return {
    id,
    source_type: "workout",
    source_id: `w_${id}`,
    occurred_at: "2026-06-10T12:00:00Z",
    visibility: "private",
    content: { title, subtitle: "", metrics: [], href: `/workouts/w_${id}` },
    reactions: { summary: {}, mine: [] },
    comment_count: 0,
  };
}

describe("TimelineFeed", () => {
  it("appends the second page on Load more and hides the button when next_before is null", async () => {
    // Resolve by args so StrictMode's double-mount (which fires the page-1
    // fetch twice) stays deterministic: page 1 has a cursor, the cursored
    // page-2 fetch exhausts it.
    listTimelineMock.mockImplementation((_token: string, opts: { before?: string }) =>
      opts.before
        ? Promise.resolve({ posts: [post("2", "Long Run")], next_before: null })
        : Promise.resolve({ posts: [post("1", "Leg Day")], next_before: "cursor-1" }),
    );

    render(<TimelineFeed />);

    // Page 1 renders + the button shows because next_before is non-null.
    await screen.findByText("Leg Day");
    const loadMore = screen.getByRole("button", { name: /load more/i });
    expect(loadMore).toBeInTheDocument();

    fireEvent.click(loadMore);

    // Page 2 appended; both pages now present.
    await screen.findByText("Long Run");
    expect(screen.getByText("Leg Day")).toBeInTheDocument();

    // Cursor exhausted → button gone.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument(),
    );

    // The load-more fetch carried the page-1 cursor.
    expect(listTimelineMock).toHaveBeenCalledWith("test-token", {
      limit: 20,
      before: "cursor-1",
    });
  });

  it("re-fetches page 1 and replaces the list when Refresh is clicked", async () => {
    // First page-1 fetch(es) (mount + StrictMode double-mount) return the
    // initial post; the Refresh re-fetch returns a fresh page-1 set. We key
    // on a call counter so the post-refresh result wins after the click.
    let refreshed = false;
    listTimelineMock.mockImplementation((_token: string, opts: { before?: string }) => {
      if (opts.before) return Promise.resolve({ posts: [], next_before: null });
      return refreshed
        ? Promise.resolve({ posts: [post("9", "Fresh Run")], next_before: null })
        : Promise.resolve({ posts: [post("1", "Leg Day")], next_before: null });
    });

    render(<TimelineFeed />);
    await screen.findByText("Leg Day");

    const callsBefore = listTimelineMock.mock.calls.length;
    refreshed = true;

    const refresh = screen.getByRole("button", { name: /refresh timeline/i });
    fireEvent.click(refresh);

    // Refresh re-calls listTimeline for page 1 (no cursor) and replaces the list.
    await screen.findByText("Fresh Run");
    expect(screen.queryByText("Leg Day")).not.toBeInTheDocument();
    expect(listTimelineMock.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(listTimelineMock).toHaveBeenLastCalledWith("test-token", { limit: 20 });
  });

  it("renders the empty state when the first page has no posts", async () => {
    listTimelineMock.mockResolvedValue({ posts: [], next_before: null });
    render(<TimelineFeed />);
    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });
});
