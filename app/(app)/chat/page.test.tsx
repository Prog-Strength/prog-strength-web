/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { UsageSnapshot } from "@/lib/usage-context";

// --- module mocks ----------------------------------------------------------

const useUsageMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn(async () => {}));
const toastErrorMock = vi.hoisted(() => vi.fn());
const createChatSessionMock = vi.hoisted(() => vi.fn(async () => ({})));

// Stable router + search params across renders. The chat page's mount
// effect depends on `[urlSessionId, router]`; a fresh object each render
// would re-fire the effect on every render → setState → infinite loop.
const routerStub = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchParamsStub = vi.hoisted(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
  useSearchParams: () => searchParamsStub,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// Speech support on so the mic button renders (SPEECH_SUPPORTED is read at
// module load, hence the factory returns a truthy ctor).
vi.mock("@/lib/speech", () => ({
  getSpeechRecognitionCtor: () => function MockRec() {},
  startSpeechSession: vi.fn(),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  createChatSession: createChatSessionMock,
  getChatSession: vi.fn(),
  appendChatTurn: vi.fn(),
  patchChatSessionTitle: vi.fn(),
}));

vi.mock("@/lib/agent", async (orig) => ({
  ...(await orig<typeof import("@/lib/agent")>()),
  generateChatTitle: vi.fn(async () => ""),
  blobToBase64: vi.fn(async () => ""),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastErrorMock, info: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock("@/lib/usage-context", () => ({
  useUsage: useUsageMock,
}));

// react-markdown / remark-gfm are heavy ESM deps the chat page imports at
// module top. The capped-state + 429 behavior under test doesn't exercise
// assistant Markdown rendering, so stub them to keep the test's transform
// graph small (the real deps blow the worker heap during collection).
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));

import ChatPage from "./page";

// --- helpers ---------------------------------------------------------------

function snapshot(
  over: Partial<UsageSnapshot> = {},
): UsageSnapshot & { refresh: () => Promise<void> } {
  return {
    percentUsed: 0,
    capped: false,
    resetsAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
    loading: false,
    error: null,
    refresh: refreshMock,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Chat — capped state", () => {
  it("disables send + mic and shows the banner when capped", async () => {
    useUsageMock.mockReturnValue(snapshot({ capped: true, percentUsed: 100 }));
    render(<ChatPage />);

    // Banner copy above the composer.
    expect(screen.getByText(/You've used your daily AI allowance/)).toBeInTheDocument();

    expect(screen.getByLabelText("Send message")).toBeDisabled();
    expect(screen.getByLabelText(/voice input/i)).toBeDisabled();
    // Voice-mode toggle in the header is disabled too.
    expect(screen.getByLabelText("Turn voice mode on")).toBeDisabled();
  });

  it("does not render the banner when under cap", () => {
    useUsageMock.mockReturnValue(snapshot({ capped: false }));
    render(<ChatPage />);
    expect(screen.queryByText(/You've used your daily AI allowance/)).not.toBeInTheDocument();
  });
});

describe("Chat — 429 convergence", () => {
  it("toasts and calls refresh when /chat returns 429", async () => {
    useUsageMock.mockReturnValue(snapshot({ capped: false }));

    const fetchMock = vi.fn(
      async () => new Response("You've used your daily AI allowance.", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<ChatPage />);

      // Wait for the new-session UUID to mint (composer enables).
      const textarea = await screen.findByPlaceholderText("Message Prog Strength…");
      await waitFor(() => expect(textarea).not.toBeDisabled());

      fireEvent.change(textarea, { target: { value: "hello" } });
      fireEvent.click(screen.getByLabelText("Send message"));

      await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
      expect(refreshMock).toHaveBeenCalled();
      // Optimistic user message + blank assistant placeholder stripped:
      // "hello" should not remain in the transcript.
      await waitFor(() => expect(screen.queryByText("hello")).not.toBeInTheDocument());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
