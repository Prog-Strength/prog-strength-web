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

import { config } from "@/lib/config";
import { WhoopConnectionRow } from "./whoop-connection-row";

// Connect/Reconnect navigate the browser; jsdom implements no navigation, so
// `location` is replaced with a plain object whose `href` the test can read
// back. Restored after each test so nothing leaks into a neighbour.
const realLocation = window.location;
function stubLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { origin: "http://localhost:3000", href: "" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
  disconnectWhoopMock.mockResolvedValue(undefined);
  stubLocation();
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
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

  // A Whoop grant is fixed at consent and a refresh cannot widen it, so a
  // connection made before `read:sleep` was requested is connected, valid, and
  // permanently missing sleep until the user re-consents. That is a capability
  // axis separate from `status` — these tests pin it as a refinement of
  // "connected", never a fourth status.
  it("renders the sleep reconnect copy and Reconnect when the sleep scope is missing", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      connected_at: "2026-05-01T00:00:00Z",
      missing_scopes: ["read:sleep"],
    });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    // ALONGSIDE Disconnect, never instead of it: this connection works and is
    // still syncing recovery, so revoking it has to stay possible.
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.getByText(/sleep tracking/)).toBeInTheDocument();
    // Product terms only — `read:sleep` is not a user-facing noun.
    expect(screen.queryByText(/read:sleep/)).not.toBeInTheDocument();
  });

  it("still disconnects an under-scoped connection", async () => {
    getWhoopConnectionMock.mockResolvedValueOnce({
      status: "connected",
      missing_scopes: ["read:sleep"],
    });
    getWhoopConnectionMock.mockResolvedValueOnce({ status: "absent" });
    render(<WhoopConnectionRow />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(disconnectWhoopMock).toHaveBeenCalledWith("test-token"));
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
  });

  it("prefers a truthful generic line when the missing scope is not sleep", async () => {
    // Naming sleep here would be a wrong specific sentence: sleep is ingesting
    // fine for this connection.
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      missing_scopes: ["read:workout"],
    });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.queryByText(/sleep tracking/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reconnect to enable the rest/)).toBeInTheDocument();
    expect(screen.queryByText(/read:workout/)).not.toBeInTheDocument();
  });

  it("keeps the connected copy and Disconnect when missing_scopes is empty", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      connected_at: "2026-05-01T00:00:00Z",
      missing_scopes: [],
    });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.getByText(/Connected since/)).toBeInTheDocument();
    expect(screen.queryByText(/sleep tracking/)).not.toBeInTheDocument();
  });

  it("keeps the connected copy and Disconnect when the key is absent (older API)", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "connected" });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.queryByText(/sleep tracking/)).not.toBeInTheDocument();
  });

  it("does not let the under-scoped branch override the error state", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "error",
      missing_scopes: ["read:sleep"],
    });
    render(<WhoopConnectionRow />);
    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByText(/needs attention/)).toBeInTheDocument();
    expect(screen.queryByText(/sleep tracking/)).not.toBeInTheDocument();
  });

  it("Reconnect from the under-scoped state runs the existing OAuth flow", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      missing_scopes: ["read:sleep"],
    });
    render(<WhoopConnectionRow />);
    fireEvent.click(await screen.findByRole("button", { name: "Reconnect" }));
    // The same URL the errored Reconnect uses — a new reason to show the
    // existing flow, not a new flow.
    expect(window.location.href).toBe(
      `${config.apiUrl}/auth/whoop/connect?return_to=${encodeURIComponent(
        "http://localhost:3000/settings?tab=integrations",
      )}`,
    );
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
