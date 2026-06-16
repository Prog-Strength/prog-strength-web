/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const listChatSessionsMock = vi.hoisted(() => vi.fn());
const deleteChatSessionMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));
vi.mock("@/lib/auth", () => ({ getToken: () => "t", clearToken: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  listChatSessions: listChatSessionsMock,
  deleteChatSession: deleteChatSessionMock,
}));

import { ConversationList } from "./conversation-list";

function sess(over = {}) {
  return {
    id: "s1",
    user_id: "u1",
    title: "Leg day plan",
    created_at: "",
    updated_at: "",
    last_message_at: new Date().toISOString(),
    message_count: 4,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders sessions from the API", async () => {
  listChatSessionsMock.mockResolvedValue([sess()]);
  render(<ConversationList activeSessionId={null} />);
  expect(await screen.findByText("Leg day plan")).toBeInTheDocument();
});

it("resumes a session on row click", async () => {
  listChatSessionsMock.mockResolvedValue([sess()]);
  render(<ConversationList activeSessionId={null} />);
  fireEvent.click(await screen.findByText("Leg day plan"));
  expect(pushMock).toHaveBeenCalledWith("/chat?session=s1");
});

it("filters sessions by the search query", async () => {
  listChatSessionsMock.mockResolvedValue([sess(), sess({ id: "s2", title: "Nutrition chat" })]);
  render(<ConversationList activeSessionId={null} />);
  await screen.findByText("Leg day plan");
  fireEvent.change(screen.getByLabelText("Search chats"), { target: { value: "nutri" } });
  expect(screen.queryByText("Leg day plan")).not.toBeInTheDocument();
  expect(screen.getByText("Nutrition chat")).toBeInTheDocument();
});

it("deletes a session after confirm", async () => {
  listChatSessionsMock.mockResolvedValue([sess()]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ConversationList activeSessionId={null} />);
  await screen.findByText("Leg day plan");
  fireEvent.click(screen.getByLabelText("Delete chat session"));
  await waitFor(() => expect(deleteChatSessionMock).toHaveBeenCalledWith("t", "s1"));
});
