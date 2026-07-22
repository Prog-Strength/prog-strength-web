/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastErrorMock = vi.hoisted(() => vi.fn());
const getWhoopConnectionMock = vi.hoisted(() => vi.fn());
const disconnectWhoopMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getWhoopConnection: getWhoopConnectionMock,
  disconnectWhoop: disconnectWhoopMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { WhoopConnectionRow } from "./whoop-connection-row";

beforeEach(() => {
  vi.clearAllMocks();
  getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
  disconnectWhoopMock.mockResolvedValue(undefined);
});

describe("WhoopConnectionRow", () => {
  it("renders Connect Whoop when the connection is absent", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("renders Connect Whoop when the connection is revoked", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "revoked" });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
  });

  it("renders a status line + Disconnect when connected", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      connected_at: "2026-05-01T00:00:00Z",
    });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.getByText(/Connected since/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Whoop" })).not.toBeInTheDocument();
  });

  it("falls back to a plain connected line when no connected_at is present", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "connected" });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.getByText(/Connected\./)).toBeInTheDocument();
  });

  it("renders Reconnect and an attention line when the status is error", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "error" });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByText(/needs attention/)).toBeInTheDocument();
  });

  it("clicking Disconnect calls disconnectWhoop() then re-fetches", async () => {
    getWhoopConnectionMock.mockResolvedValueOnce({ status: "connected" });
    getWhoopConnectionMock.mockResolvedValueOnce({ status: "absent" });
    render(<WhoopConnectionRow />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(disconnectWhoopMock).toHaveBeenCalledWith("test-token"));
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
  });

  it("toasts on a disconnect failure and keeps the connected state", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "connected" });
    disconnectWhoopMock.mockRejectedValueOnce(new Error("boom"));
    render(<WhoopConnectionRow />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("boom"));
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });
});
