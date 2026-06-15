/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ProfileSummary } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const requestFollowMock = vi.hoisted(() => vi.fn());
const cancelOrUnfollowMock = vi.hoisted(() => vi.fn());
const acceptFollowMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  requestFollow: requestFollowMock,
  cancelOrUnfollow: cancelOrUnfollowMock,
  acceptFollow: acceptFollowMock,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorToastMock, info: vi.fn(), dismiss: vi.fn() }),
}));

import { FollowButton } from "./FollowButton";

beforeEach(() => {
  vi.clearAllMocks();
});

function edge(relationship: ProfileSummary["relationship"]): ProfileSummary {
  return {
    user_id: "u1",
    username: "sam",
    display_name: "Sam Lifter",
    avatar_url: null,
    relationship,
  };
}

describe("FollowButton", () => {
  it("none → requested: optimistically shows Requested and reconciles to the returned edge", async () => {
    // A private target comes back "requested".
    requestFollowMock.mockResolvedValue(edge("requested"));
    render(<FollowButton username="sam" relationship="none" />);

    fireEvent.click(screen.getByRole("button", { name: /follow/i }));

    // Optimistic flip is immediate.
    expect(await screen.findByText("Requested")).toBeInTheDocument();
    expect(requestFollowMock).toHaveBeenCalledWith("test-token", "sam");
    // The settled edge keeps it on "Requested".
    await waitFor(() => expect(screen.getByText("Requested")).toBeInTheDocument());
  });

  it("none → following: a public target reconciles to Following", async () => {
    requestFollowMock.mockResolvedValue(edge("following"));
    render(<FollowButton username="sam" relationship="none" />);

    fireEvent.click(screen.getByRole("button", { name: /follow/i }));

    expect(await screen.findByText("Following")).toBeInTheDocument();
  });

  it("none → (error) rolls back to Follow and toasts", async () => {
    requestFollowMock.mockRejectedValue(new Error("boom"));
    render(<FollowButton username="sam" relationship="none" />);

    fireEvent.click(screen.getByRole("button", { name: /follow/i }));

    // Briefly optimistic, then rolled back to Follow.
    await waitFor(() => expect(screen.getByText("Follow")).toBeInTheDocument());
    expect(errorToastMock).toHaveBeenCalledWith("boom");
  });

  it("requested → none: cancel removes the request", async () => {
    cancelOrUnfollowMock.mockResolvedValue(undefined);
    render(<FollowButton username="sam" relationship="requested" />);

    expect(screen.getByText("Requested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel follow request/i }));

    expect(await screen.findByText("Follow")).toBeInTheDocument();
    expect(cancelOrUnfollowMock).toHaveBeenCalledWith("test-token", "sam");
  });

  it("following → none: unfollow tears down the edge", async () => {
    cancelOrUnfollowMock.mockResolvedValue(undefined);
    render(<FollowButton username="sam" relationship="following" />);

    expect(screen.getByText("Following")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /unfollow/i }));

    expect(await screen.findByText("Follow")).toBeInTheDocument();
    expect(cancelOrUnfollowMock).toHaveBeenCalledWith("test-token", "sam");
  });

  it("pending_incoming → following: accept turns the row into Following", async () => {
    acceptFollowMock.mockResolvedValue(edge("following"));
    render(<FollowButton username="sam" relationship="pending_incoming" />);

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    expect(await screen.findByText("Following")).toBeInTheDocument();
    expect(acceptFollowMock).toHaveBeenCalledWith("test-token", "sam");
  });

  it("self renders nothing", () => {
    const { container } = render(<FollowButton username="sam" relationship="self" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onChange with the settled relationship", async () => {
    requestFollowMock.mockResolvedValue(edge("following"));
    const onChange = vi.fn();
    render(<FollowButton username="sam" relationship="none" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /follow/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("following"));
  });
});
