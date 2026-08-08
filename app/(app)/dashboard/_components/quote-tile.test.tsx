/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteView } from "@/lib/dashboard";
import { QuoteCard } from "./quote-tile";

const rerollDashboardQuoteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  rerollDashboardQuote: rerollDashboardQuoteMock,
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
  rerollDashboardQuoteMock.mockReset();
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
    // The card itself stays non-navigable. Since the attribution can now
    // carry Wikipedia links, this asserts on a quote that has none, so it
    // keeps testing the card rather than accidentally testing the links.
    const { container } = render(<QuoteCard quote={quote()} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("links the author to Wikipedia when the corpus has an article", () => {
    render(
      <QuoteCard
        quote={quote({ authorUrl: "https://en.wikipedia.org/wiki/Ralph_Waldo_Emerson" })}
      />,
    );
    const link = screen.getByRole("link", { name: "Ralph Waldo Emerson" });
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Ralph_Waldo_Emerson");
  });

  it("opens links in a new tab without handing over the opener", () => {
    // The dashboard is the thing the user came for; reading about Camus
    // should not navigate it away. rel guards the new tab against
    // window.opener access.
    render(
      <QuoteCard
        quote={quote({ authorUrl: "https://en.wikipedia.org/wiki/Ralph_Waldo_Emerson" })}
      />,
    );
    const link = screen.getByRole("link", { name: "Ralph Waldo Emerson" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the author as plain text when there is no article", () => {
    render(<QuoteCard quote={quote()} />);
    expect(screen.getByText("Ralph Waldo Emerson")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ralph Waldo Emerson" })).not.toBeInTheDocument();
  });

  it("links the source to Wikipedia when the corpus has an article", () => {
    render(
      <QuoteCard
        quote={quote({
          id: "coelho-dream-come-true",
          author: "Paulo Coelho",
          authorUrl: "https://en.wikipedia.org/wiki/Paulo_Coelho",
          source: "The Alchemist",
          sourceUrl: "https://en.wikipedia.org/wiki/The_Alchemist_(novel)",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "The Alchemist" })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/The_Alchemist_(novel)",
    );
    expect(screen.getByRole("link", { name: "Paulo Coelho" })).toBeInTheDocument();
  });

  it("renders a linked author with an unlinked source", () => {
    // The real shape of the Camus entry: the man has an article, the essay
    // does not. Each half of the attribution decides independently.
    render(
      <QuoteCard
        quote={quote({
          id: "camus-invincible-summer",
          author: "Albert Camus",
          authorUrl: "https://en.wikipedia.org/wiki/Albert_Camus",
          source: "Return to Tipasa",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "Albert Camus" })).toBeInTheDocument();
    expect(screen.getByText("Return to Tipasa")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Return to Tipasa" })).not.toBeInTheDocument();
  });

  it("swaps the links along with the quote on reroll", async () => {
    // The links live on the same state as the text, so a reroll that
    // updated one without the other would attribute the new quote to the
    // old author's article.
    rerollDashboardQuoteMock.mockResolvedValue({
      id: "frost-it-goes-on",
      text: "In three words I can sum up everything I've learned about life: It goes on.",
      author: "Robert Frost",
      authorUrl: "https://en.wikipedia.org/wiki/Robert_Frost",
      offset: 1,
    });

    render(
      <QuoteCard
        quote={quote({ authorUrl: "https://en.wikipedia.org/wiki/Ralph_Waldo_Emerson" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Robert Frost" })).toHaveAttribute(
        "href",
        "https://en.wikipedia.org/wiki/Robert_Frost",
      ),
    );
    expect(screen.queryByRole("link", { name: "Ralph Waldo Emerson" })).not.toBeInTheDocument();
  });

  it("asks the server to advance and swaps in the result", async () => {
    rerollDashboardQuoteMock.mockResolvedValue({
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
  });

  it("sends no offset — the server owns the position", async () => {
    // The client used to send offset + 1 from its own state. It must not:
    // with the offset persisted server-side, a second tab holding a stale
    // number would drag the position backwards on its next tap.
    rerollDashboardQuoteMock.mockResolvedValue(quote({ offset: 1 }));

    render(<QuoteCard quote={quote({ offset: 7 })} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() => expect(rerollDashboardQuoteMock).toHaveBeenCalled());
    expect(rerollDashboardQuoteMock.mock.calls[0]).toHaveLength(2);
  });

  it("re-asks on each successive reroll", async () => {
    rerollDashboardQuoteMock
      .mockResolvedValueOnce({ id: "b", text: "Second.", author: "B", offset: 1 })
      .mockResolvedValueOnce({ id: "c", text: "Third.", author: "C", offset: 2 });

    render(<QuoteCard quote={quote()} />);
    const button = screen.getByRole("button", { name: /another quote/i });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Second\./)).toBeInTheDocument());
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Third\./)).toBeInTheDocument());

    expect(rerollDashboardQuoteMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the current quote when the reroll fails", async () => {
    rerollDashboardQuoteMock.mockRejectedValue(new Error("network"));

    render(<QuoteCard quote={quote()} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /another quote/i })).not.toBeDisabled(),
    );
    expect(screen.getByText(/Insist on yourself/)).toBeInTheDocument();
  });

  it("passes the browser timezone so the day rolls over locally", async () => {
    rerollDashboardQuoteMock.mockResolvedValue(quote({ offset: 1 }));

    render(<QuoteCard quote={quote()} />);
    fireEvent.click(screen.getByRole("button", { name: /another quote/i }));

    await waitFor(() => expect(rerollDashboardQuoteMock).toHaveBeenCalled());
    const [, timezone] = rerollDashboardQuoteMock.mock.calls[0];
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
