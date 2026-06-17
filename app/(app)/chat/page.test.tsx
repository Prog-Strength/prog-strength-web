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
  // The persistent ConversationList pane now renders inside the page and
  // fetches the session list on mount; stub both list/delete calls so the
  // page renders without hitting a real fetch under test.
  listChatSessions: vi.fn(async () => []),
  deleteChatSession: vi.fn(async () => {}),
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

const useProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/profile-context", () => ({
  useProfile: useProfileMock,
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

// Default resolved profile for the shared context; individual tests can
// override via useProfileMock.mockReturnValue.
function profileCtx(over: Record<string, unknown> = {}) {
  return {
    profile: {
      id: "u1",
      email: "lifter@example.com",
      display_name: "Sam",
      weight_unit: "lb",
      distance_unit: "mi",
      height_cm: 180,
      avatar_url: null,
    },
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
    update: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProfileMock.mockReturnValue(profileCtx());
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

describe("Chat — profile in /chat payload", () => {
  it("sends display_name and height_cm from the resolved profile", async () => {
    useUsageMock.mockReturnValue(snapshot({ capped: false }));
    useProfileMock.mockReturnValue(
      profileCtx({
        profile: {
          id: "u1",
          email: "lifter@example.com",
          display_name: "Sam",
          weight_unit: "lb",
          distance_unit: "mi",
          height_cm: 193,
          avatar_url: null,
        },
      }),
    );

    // A streaming-shaped 200 with no SSE events — enough to exercise the
    // request body without driving the full stream parser.
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<ChatPage />);

      const textarea = await screen.findByPlaceholderText("Message Prog Strength…");
      await waitFor(() => expect(textarea).not.toBeDisabled());

      fireEvent.change(textarea, { target: { value: "hi" } });
      fireEvent.click(screen.getByLabelText("Send message"));

      await waitFor(() => {
        // mock.calls entries are typed as the factory's params ([]), so
        // read them through `unknown[]` to inspect the fetch URL + init.
        const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
        const chatCall = calls.find((c) => String(c[0]).endsWith("/chat"));
        expect(chatCall).toBeTruthy();
        const body = JSON.parse(chatCall![1].body as string);
        expect(body.display_name).toBe("Sam");
        expect(body.height_cm).toBe(193);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends UPDATED display_name and height_cm after the profile changes mid-session", async () => {
    // Regression lock-in for the send useCallback dep-array fix: if `profile`
    // is missing from the deps, the second send re-uses the stale closure and
    // transmits the OLD name/height. Re-rendering with a new useProfile return
    // and asserting the SECOND /chat body carries the new values proves the
    // callback re-binds to the current profile.
    useUsageMock.mockReturnValue(snapshot({ capped: false }));
    useProfileMock.mockReturnValue(
      profileCtx({
        profile: {
          id: "u1",
          email: "lifter@example.com",
          display_name: "Sam",
          weight_unit: "lb",
          distance_unit: "mi",
          height_cm: 180,
          avatar_url: null,
        },
      }),
    );

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const { rerender } = render(<ChatPage />);

      const textarea = await screen.findByPlaceholderText("Message Prog Strength…");
      await waitFor(() => expect(textarea).not.toBeDisabled());

      // First send — carries the original profile values.
      fireEvent.change(textarea, { target: { value: "first" } });
      fireEvent.click(screen.getByLabelText("Send message"));

      await waitFor(() => {
        const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
        expect(calls.some((c) => String(c[0]).endsWith("/chat"))).toBe(true);
      });
      const firstCall = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(
        (c) => String(c[0]).endsWith("/chat"),
      );
      const firstBody = JSON.parse(firstCall![1].body as string);
      expect(firstBody.display_name).toBe("Sam");
      expect(firstBody.height_cm).toBe(180);

      // User edits their profile mid-session: useProfile now returns NEW values.
      useProfileMock.mockReturnValue(
        profileCtx({
          profile: {
            id: "u1",
            email: "lifter@example.com",
            display_name: "Alex",
            weight_unit: "lb",
            distance_unit: "mi",
            height_cm: 165,
            avatar_url: null,
          },
        }),
      );
      rerender(<ChatPage />);

      await waitFor(() => expect(textarea).not.toBeDisabled());

      // Second send — must carry the UPDATED profile values, not the stale ones.
      fireEvent.change(textarea, { target: { value: "second" } });
      fireEvent.click(screen.getByLabelText("Send message"));

      await waitFor(() => {
        const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
        const chatCalls = calls.filter((c) => String(c[0]).endsWith("/chat"));
        expect(chatCalls.length).toBeGreaterThanOrEqual(2);
        const secondBody = JSON.parse(chatCalls[chatCalls.length - 1][1].body as string);
        expect(secondBody.display_name).toBe("Alex");
        expect(secondBody.height_cm).toBe(165);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Chat — history pane toggle", () => {
  it("starts collapsed and toggles the history pane open/closed", () => {
    useUsageMock.mockReturnValue(snapshot({ capped: false }));
    render(<ChatPage />);

    // The header "Chats" control toggles the conversation pane. It defaults
    // to collapsed so the pane doesn't eat chat space on load.
    const toggle = screen.getByRole("button", { name: /chats/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
