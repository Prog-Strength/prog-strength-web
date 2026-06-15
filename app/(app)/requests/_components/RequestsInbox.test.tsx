/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FollowRequest } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const listFollowRequestsMock = vi.hoisted(() => vi.fn());
const acceptFollowMock = vi.hoisted(() => vi.fn());
const rejectFollowMock = vi.hoisted(() => vi.fn());
const cancelOrUnfollowMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  listFollowRequests: listFollowRequestsMock,
  acceptFollow: acceptFollowMock,
  rejectFollow: rejectFollowMock,
  cancelOrUnfollow: cancelOrUnfollowMock,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorToastMock, info: vi.fn(), dismiss: vi.fn() }),
}));

// Render ProfileRow's identity + the caller-provided action so we can assert
// rows disappear and the buttons are present, without dragging in Avatar/Link.
vi.mock("@/components/social/ProfileRow", () => ({
  ProfileRow: ({ user, action }: { user: { display_name: string }; action: React.ReactNode }) => (
    <div data-testid="row">
      {user.display_name}
      {action}
    </div>
  ),
}));

import { RequestsInbox } from "./RequestsInbox";

beforeEach(() => {
  vi.clearAllMocks();
});

function req(id: string, name: string): FollowRequest {
  return {
    user_id: id,
    username: name.toLowerCase(),
    display_name: name,
    avatar_url: null,
    relationship: "pending_incoming",
    created_at: "2026-06-14T12:00:00Z",
  };
}

describe("RequestsInbox", () => {
  it("removes a row optimistically on Accept", async () => {
    listFollowRequestsMock.mockResolvedValue({
      requests: [req("1", "Alice"), req("2", "Bob")],
      next_cursor: null,
    });
    acceptFollowMock.mockResolvedValue({ relationship: "following" });

    render(<RequestsInbox />);
    await screen.findByText("Alice");

    // Two rows; accept the first.
    const accepts = screen.getAllByRole("button", { name: /accept/i });
    fireEvent.click(accepts[0]);

    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(acceptFollowMock).toHaveBeenCalledWith("test-token", "alice");
  });

  it("removes a row optimistically on Reject", async () => {
    listFollowRequestsMock.mockResolvedValue({
      requests: [req("1", "Alice")],
      next_cursor: null,
    });
    rejectFollowMock.mockResolvedValue(undefined);

    render(<RequestsInbox />);
    await screen.findByText("Alice");

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(rejectFollowMock).toHaveBeenCalledWith("test-token", "alice");
  });

  it("restores the row and toasts when accept fails", async () => {
    listFollowRequestsMock.mockResolvedValue({
      requests: [req("1", "Alice")],
      next_cursor: null,
    });
    acceptFollowMock.mockRejectedValue(new Error("nope"));

    render(<RequestsInbox />);
    await screen.findByText("Alice");

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    // Rolled back: the row comes back and a toast fires.
    await waitFor(() => expect(errorToastMock).toHaveBeenCalledWith("nope"));
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("switches to the outgoing tab and shows a Cancel action", async () => {
    listFollowRequestsMock.mockImplementation((_t: string, direction: string) =>
      Promise.resolve({
        requests: direction === "incoming" ? [req("1", "Alice")] : [req("9", "Carol")],
        next_cursor: null,
      }),
    );

    render(<RequestsInbox />);
    await screen.findByText("Alice");

    fireEvent.click(screen.getByRole("tab", { name: /outgoing/i }));

    await screen.findByText("Carol");
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(listFollowRequestsMock).toHaveBeenLastCalledWith("test-token", "outgoing");
  });
});
