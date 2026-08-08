/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteView } from "@/lib/dashboard";
import { QuoteCard } from "./quote-tile";

const getDashboardQuoteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getDashboardQuote: getDashboardQuoteMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

function quote(overrides: Partial<QuoteView> = {}): QuoteView {
  return {
    id: "emerson-insist-on-yourself",
    text: "Insist on yourself; never imitate.",
    author: "Ralph Waldo Emerson",
    offset: 0,
    ...overrides,
  };
}

beforeEach(() => {
  getDashboardQuoteMock.mockReset();
});

describe("QuoteCard", () => {
  it("renders the quote and its attribution", () => {
    render(<QuoteCard quote={quote()} />);
    expect(screen.getByText(/Insist on yourself; never imitate\./)).toBeInTheDocument();
    expect(screen.getByText("Ralph Waldo Emerson")).toBeInTheDocument();
  });

  it("omits the source when the attribution is unverified", () => {
    render(<QuoteCard quote={quote()} />);
    expect(screen.queryByText("The Alchemist")).not.toBeInTheDocument();
  });

  it("renders the source when the attribution is verified", () => {
    render(
      <QuoteCard
        quote={quote({
          id: "coelho-dream-come-true",
          source: "The Alchemist",
          author: "Paulo Coelho",
        })}
      />,
    );
    expect(screen.getByText("The Alchemist")).toBeInTheDocument();
  });

  it("is not a link — there is no quote page to navigate to", () => {
    const { container } = render(<QuoteCard quote={quote()} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("asks for the next offset and swaps in the result", async () => {
    getDashboardQuoteMock.mockResolvedValue({
      id: "frost-it-goes-on",
      text: "In three words I can sum up everything I've learned about life: It goes on.",
      author: "Robert Frost",
      offset: 1,
    });

    render(<QuoteCard quote={quote()} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() => expect(screen.getByText(/It goes on\./)).toBeInTheDocument());
    expect(screen.getByText("Robert Frost")).toBeInTheDocument();
    expect(screen.queryByText(/Insist on yourself/)).not.toBeInTheDocument();

    const [, , offset] = getDashboardQuoteMock.mock.calls[0];
    expect(offset).toBe(1);
  });

  it("advances the offset on each successive reroll", async () => {
    getDashboardQuoteMock
      .mockResolvedValueOnce({ id: "b", text: "Second.", author: "B", offset: 1 })
      .mockResolvedValueOnce({ id: "c", text: "Third.", author: "C", offset: 2 });

    render(<QuoteCard quote={quote()} />);
    const button = screen.getByRole("button", { name: /another quote/i });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Second\./)).toBeInTheDocument());
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Third\./)).toBeInTheDocument());

    expect(getDashboardQuoteMock.mock.calls.map((c) => c[2])).toEqual([1, 2]);
  });

  it("keeps the current quote when the reroll fails", async () => {
    getDashboardQuoteMock.mockRejectedValue(new Error("network"));

    render(<QuoteCard quote={quote()} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /another quote/i })).not.toBeDisabled(),
    );
    expect(screen.getByText(/Insist on yourself/)).toBeInTheDocument();
  });

  it("passes the browser timezone so the day rolls over locally", async () => {
    getDashboardQuoteMock.mockResolvedValue(quote({ offset: 1 }));

    render(<QuoteCard quote={quote()} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() => expect(getDashboardQuoteMock).toHaveBeenCalled());
    const [, timezone] = getDashboardQuoteMock.mock.calls[0];
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
