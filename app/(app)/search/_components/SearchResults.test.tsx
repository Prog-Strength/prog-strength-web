/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ProfileSummary } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const searchProfilesMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  searchProfiles: searchProfilesMock,
}));

// ProfileRow pulls in FollowButton (toast/api); stub it to a trivial node so
// this test stays focused on ranking + pagination + the self row.
vi.mock("@/components/social/ProfileRow", () => ({
  ProfileRow: ({ user }: { user: ProfileSummary }) => (
    <div data-testid="row">
      {user.display_name}
      {user.relationship === "self" && <span> (you)</span>}
    </div>
  ),
}));

import { SearchResults } from "./SearchResults";

beforeEach(() => {
  vi.clearAllMocks();
});

function profile(
  id: string,
  name: string,
  relationship: ProfileSummary["relationship"] = "none",
): ProfileSummary {
  return {
    user_id: id,
    username: name.toLowerCase().replace(/\s+/g, ""),
    display_name: name,
    avatar_url: null,
    relationship,
  };
}

describe("SearchResults", () => {
  it("renders ranked rows in order, handles the self row, and appends on Load more", async () => {
    searchProfilesMock.mockImplementation((_t: string, _q: string, cursor?: string) =>
      cursor
        ? Promise.resolve({ users: [profile("3", "Third")], next_cursor: null })
        : Promise.resolve({
            users: [profile("1", "First"), profile("2", "You", "self")],
            next_cursor: "cur-1",
          }),
    );

    render(<SearchResults />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search people/i }), {
      target: { value: "th" },
    });

    // Debounced first page renders, in rank order.
    await screen.findByText("First");
    const rows = screen.getAllByTestId("row");
    expect(rows[0]).toHaveTextContent("First");
    expect(rows[1]).toHaveTextContent("You");
    // Self row is flagged (no follow action).
    expect(screen.getByText("(you)")).toBeInTheDocument();

    // Load more appends page 2 using the cursor.
    const loadMore = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMore);

    await screen.findByText("Third");
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(searchProfilesMock).toHaveBeenLastCalledWith("test-token", "th", "cur-1");

    // Cursor exhausted → button gone.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument(),
    );
  });

  it("shows the empty state when a query returns no people", async () => {
    searchProfilesMock.mockResolvedValue({ users: [], next_cursor: null });
    render(<SearchResults />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search people/i }), {
      target: { value: "nobody" },
    });

    expect(await screen.findByText(/no people found/i)).toBeInTheDocument();
  });

  it("does not search on a blank query", async () => {
    render(<SearchResults />);
    // No input change → no search fired.
    await waitFor(() => expect(searchProfilesMock).not.toHaveBeenCalled());
  });
});
