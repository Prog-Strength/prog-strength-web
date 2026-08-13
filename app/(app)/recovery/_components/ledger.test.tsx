/// <reference types="vitest/globals" />

import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RecoveryDayPoint } from "@/lib/dashboard";
import { defaultView, FIXTURE_TODAY } from "../fixtures";
import { addDays, LEDGER_PAGE_SIZE } from "./shared";
import { Ledger } from "./ledger";

// jsdom doesn't implement matchMedia; `useIsMobile` subscribes to it for its
// mobile/desktop snapshot. A minimal, non-matching stub gives every test below
// the desktop rendering — `longDate` in the date column, 12px figures.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * The owner of the page number, mirrored — the `/recovery` page holds it in
 * exactly this shape, opening on 1 (correction 3). Paging is controlled, so
 * "opens on page 1" is a property of that initial value plus the ledger's
 * refusal to move itself; both halves are asserted below.
 */
function Controlled({
  days,
  selectedDate = null,
  onPage,
}: {
  days: RecoveryDayPoint[];
  selectedDate?: string | null;
  onPage?: (p: number) => void;
}) {
  const [page, setPage] = useState(1);
  return (
    <Ledger
      days={days}
      selectedDate={selectedDate}
      page={page}
      onPage={(p) => {
        setPage(p);
        onPage?.(p);
      }}
    />
  );
}

/** `n` consecutive recorded mornings, newest on `FIXTURE_TODAY`. */
function recordedMornings(n: number): RecoveryDayPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: addDays(FIXTURE_TODAY, -(n - 1 - i)),
    restingHr: 50,
    recoveryScore: 71,
    hrv: 90,
    baselineAvg: 90,
    balancedLow: 80,
    balancedHigh: 100,
    zScore: 0,
    status: "balanced" as const,
  }));
}

const DAYS = defaultView().days!;

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="ledger-row"]'));
}

/** Collapsed text of a subtree — the gaps are grid, not text. */
function text(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** One row read as its four columns in DOM order: date · score · bpm · ms. */
function fields(row: Element): string[] {
  return Array.from(row.children)
    .map((child) => text(child))
    .filter((value) => value !== "");
}

function rowFor(container: HTMLElement, date: string): HTMLElement | undefined {
  return rows(container).find((row) => fields(row)[0] === date);
}

describe("Ledger — where it opens", () => {
  it("opens on page 1, newest morning first", () => {
    const { container } = render(<Controlled days={DAYS} />);
    // Wed 12 Aug is the last stored morning. The mockup's `useState(4)` was a
    // DX staging device; a user asking how last week went sees last week.
    expect(fields(rows(container)[0])[0]).toBe("Wed 12 Aug");
    expect(screen.getByText(/^Page 1 of/)).toBeInTheDocument();
  });

  it("prints one page of rows, not the whole fourteen months", () => {
    const { container } = render(<Controlled days={DAYS} />);
    expect(rows(container)).toHaveLength(LEDGER_PAGE_SIZE);
  });

  it("counts REAL rows, never the materialized date slots", () => {
    // 428 stored slots, twelve of which Whoop never recorded.
    const recorded = DAYS.filter(
      (d) => d.recoveryScore !== null || d.restingHr !== null || d.hrv !== null,
    ).length;
    render(<Controlled days={DAYS} />);
    expect(recorded).toBeLessThan(DAYS.length);
    expect(screen.getByText(`${recorded} mornings`)).toBeInTheDocument();
  });
});

describe("Ledger — paging over all stored history", () => {
  it("pages 425 mornings into 22 and advances on Next", () => {
    const days = recordedMornings(425);
    const { container } = render(<Controlled days={days} />);
    expect(screen.getByText("Page 1 of 22")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 22")).toBeInTheDocument();
    // Page 2 starts at the 21st-newest morning.
    expect(fields(rows(container)[0])[0]).toBe("Thu 23 Jul");
  });

  it("disables Prev on the first page and Next on the last", () => {
    render(<Controlled days={recordedMornings(425)} />);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();

    for (let i = 0; i < 21; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText("Page 22 of 22")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Prev" })).not.toBeDisabled();
  });

  it("shows no pager when the whole record fits on one page", () => {
    render(<Controlled days={recordedMornings(LEDGER_PAGE_SIZE)} />);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByText(/^Page /)).toBeNull();
  });
});

describe("Ledger — absences", () => {
  it("drops a morning Whoop never recorded", () => {
    const { container } = render(<Controlled days={DAYS} />);
    // Fri 7 Aug has no reading of any kind. The plots keep the slot so the
    // absence is visible on the axis; the record has nothing to record.
    expect(rowFor(container, "Fri 7 Aug")).toBeUndefined();
    expect(rowFor(container, "Sat 8 Aug")).toBeDefined();
    expect(rowFor(container, "Thu 6 Aug")).toBeDefined();
  });

  it("keeps a partial morning and prints an em-dash for the metric it lacks", () => {
    const { container } = render(<Controlled days={DAYS} />);
    // Sun 9 Aug was never scored, but 51 bpm and 88 ms were recorded.
    expect(fields(rowFor(container, "Sun 9 Aug")!)).toEqual(["Sun 9 Aug", "—", "51", "88"]);
  });

  it("says so in one line rather than drawing an empty grid", () => {
    const { container } = render(<Controlled days={[]} />);
    expect(rows(container)).toHaveLength(0);
    expect(screen.getByText(/No mornings recorded yet/)).toBeInTheDocument();
    expect(screen.queryByText(/0 mornings/)).toBeNull();
  });
});

describe("Ledger — the jump link", () => {
  it("offers the move when the selection is off-page, and names the page", () => {
    // The 21st-newest recorded morning is the first row of page 2.
    render(<Controlled days={DAYS} selectedDate="2026-07-21" />);
    const link = screen.getByRole("button", { name: /21 Jul is on page/ });
    expect(text(link)).toBe("21 Jul is on page 2 →");
  });

  it("pages there when clicked — and only then", () => {
    const onPage = vi.fn();
    const { container } = render(
      <Controlled days={DAYS} selectedDate="2026-07-21" onPage={onPage} />,
    );
    // Selecting a morning must never silently re-page the ledger underneath the
    // user's hands: page 1 is still on screen until the offer is taken.
    expect(onPage).not.toHaveBeenCalled();
    expect(screen.getByText("Page 1 of 21")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /21 Jul is on page/ }));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText("Page 2 of 21")).toBeInTheDocument();
    expect(rowFor(container, "Tue 21 Jul")).toBeDefined();
    // Once the selection is in view the offer has nothing left to offer.
    expect(screen.queryByRole("button", { name: /is on page/ })).toBeNull();
  });

  it("stays away when the selected morning is already on this page", () => {
    const onPage = vi.fn();
    const { container } = render(
      <Controlled days={DAYS} selectedDate="2026-08-10" onPage={onPage} />,
    );
    expect(screen.queryByRole("button", { name: /is on page/ })).toBeNull();
    expect(onPage).not.toHaveBeenCalled();
    expect(rowFor(container, "Mon 10 Aug")!.className).toContain("bg-[var(--accent-soft)]");
  });

  it("stays away when the selection is a morning the ledger has no row for", () => {
    // Fri 7 Aug was never recorded — there is no page to send anyone to.
    render(<Controlled days={DAYS} selectedDate="2026-08-07" />);
    expect(screen.queryByRole("button", { name: /is on page/ })).toBeNull();
  });
});

describe("Ledger — the rhythm and the pill", () => {
  it("holds every row to a strict 30px", () => {
    const { container } = render(<Controlled days={DAYS} />);
    // The uniform rhythm is one of the variant's three distinguishing
    // properties: a row that grew by a line would undo the whole register.
    for (const row of rows(container)) {
      expect(row.className).toContain("h-[30px]");
    }
  });

  it("marks the selected row with a fill and a 2px left rule", () => {
    const { container } = render(<Controlled days={DAYS} selectedDate={FIXTURE_TODAY} />);
    const row = rowFor(container, "Wed 12 Aug")!;
    expect(row.className).toContain("bg-[var(--accent-soft)]");
    expect(row.querySelector(".bg-\\[var\\(--accent-line\\)\\]")?.className).toContain("w-[2px]");
  });

  it("tints the score pill with its own band's colour and word", () => {
    const { container } = render(<Controlled days={DAYS} />);
    // Wed 12 Aug is a 13 — Whoop's bottom third, and the one place in this
    // family allowed to read `--danger`.
    const bad = within(rowFor(container, "Wed 12 Aug")!).getByTitle("Low");
    expect(text(bad)).toBe("13");
    expect(bad.style.color).toBe("var(--danger)");
    expect(bad.getAttribute("style")).toContain(
      "color-mix(in srgb, var(--danger) 14%, transparent)",
    );

    // …and Tue 11 Aug's 78 is a green one, so the colour is per-morning.
    const good = within(rowFor(container, "Tue 11 Aug")!).getByTitle("Recovered");
    expect(good.style.color).toBe("var(--success)");
  });

  it("gives an unscored morning the muted pill and no band word", () => {
    const { container } = render(<Controlled days={DAYS} />);
    const none = within(rowFor(container, "Sun 9 Aug")!).getByTitle("No reading");
    expect(none.style.color).toBe("var(--muted)");
  });
});
