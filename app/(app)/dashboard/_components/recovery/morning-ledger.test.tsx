/// <reference types="vitest/globals" />

import { render, screen, within } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import {
  calibratingView,
  legacyView,
  partialBandView,
  partialMorningView,
  recoveryLogView,
  sparseView,
} from "./fixtures";
import { MorningLedgerCard, railY } from "./morning-ledger";

const HREF = "/recovery";
/** The rail's contract, mirrored — not an implementation detail. */
const RAIL_H = 40;
const RAIL_DAYS = 14;

function renderCard(section: RecoveryView) {
  return render(<MorningLedgerCard section={section} href={HREF} />);
}

/** Collapsed text of a whole subtree, for "does this string appear at all". */
function text(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * A detail row read as its FIELDS in DOM order. `textContent` would run the
 * siblings together (`Mon52Adequate…`) because the gaps are flex, not text —
 * and reading the fields is the stronger assertion anyway, since it pins the
 * row's reading order: Recovery → resting HR → HRV.
 */
function fields(row: Element): string[] {
  return Array.from(row.children).map((child) => text(child));
}

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="rail-bar"]'));
}
function ghosts(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="rail-ghost"]'));
}
function tick(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="rail-tick"]');
}
function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="detail-row"]'));
}
/** The calibrating fixture with the two day-counts deliberately disagreeing. */
function calibratingMismatched(): RecoveryView {
  const view = calibratingView();
  // 9 scored mornings behind the rail; 22 HRV nights behind a metric this tile
  // does not draw. The two are emitted independently and can differ by weeks.
  return { ...view, baseline: { ...view.baseline!, recoveryScoreDays: 9, hrvDays: 22 } };
}

describe("MorningLedgerCard — the seam", () => {
  it("prints the baselines in score · bpm · ms order, rounded", () => {
    renderCard(recoveryLogView());
    // 57.6 · 53.4 bpm · 88.2 ms → rounded. A change from the shipped ms · bpm · score.
    expect(screen.getByText("58 · 53 bpm · 88 ms")).toBeInTheDocument();
  });

  it("dashes each baseline figure independently and keeps the line's shape", () => {
    const view = recoveryLogView();
    renderCard({ ...view, baseline: { ...view.baseline!, hrvAvg: null } });
    expect(screen.getByText("58 · 53 bpm · — ms")).toBeInTheDocument();
  });

  it("counts MORNINGS, not nights — the gate and the progress line are one metric", () => {
    renderCard(calibratingMismatched());
    expect(screen.getByText("calibrating")).toBeInTheDocument();
    expect(screen.getByText("9 of 14 mornings")).toBeInTheDocument();
  });

  it("never prints the HRV night count or calls a morning a night", () => {
    const { container } = renderCard(calibratingMismatched());
    expect(text(container)).not.toMatch(/night/i);
    expect(text(container)).not.toContain("22");
  });
});

describe("MorningLedgerCard — the rail", () => {
  it("renders one position per calendar day in the window", () => {
    const view = recoveryLogView();
    const { container } = renderCard(view);
    const window = view.days!.slice(-RAIL_DAYS);
    expect(bars(container).length + ghosts(container).length).toBe(RAIL_DAYS);
    expect(bars(container)).toHaveLength(window.filter((d) => d.recoveryScore !== null).length);
    expect(ghosts(container)).toHaveLength(window.filter((d) => d.recoveryScore === null).length);
  });

  it("paints each bar in its own morning's band colour", () => {
    const { container } = renderCard(recoveryLogView());
    const fills = bars(container).map((b) => b.style.backgroundColor);
    // Sunday's 29 is a --danger bar in a rail that is otherwise warm.
    expect(fills).toContain("var(--danger)");
    expect(fills).toContain("var(--warning)");
    expect(fills).toContain("var(--success)");
  });

  it("draws an absent morning as a full-height ghost, differing in KIND not height", () => {
    const { container } = renderCard(sparseView());
    const ghost = ghosts(container)[0];
    const bar = bars(container)[0];
    // A ghost runs the whole rail and carries no inline height cap...
    expect(ghost.className).toContain("h-full");
    expect(ghost.style.height).toBe("");
    // ...while a scored bar is capped at its own score's pixel height. A 2px
    // stub at the foot of the rail would fail both halves of this.
    expect(Number.parseFloat(bar.style.height)).toBeGreaterThan(2);
    expect(Number.parseFloat(bar.style.height)).toBeLessThan(RAIL_H);
  });

  it("maps every bar through railY, so a score of 100 is the whole rail", () => {
    expect(railY(0)).toBe(0);
    expect(railY(100)).toBe(RAIL_H);
    const view = recoveryLogView();
    const { container } = renderCard(view);
    const scored = view.days!.slice(-RAIL_DAYS).filter((d) => d.recoveryScore !== null);
    bars(container).forEach((bar, i) => {
      expect(Number.parseFloat(bar.style.height)).toBeCloseTo(
        Math.max(2, railY(scored[i].recoveryScore!)),
        5,
      );
    });
  });

  it("pins the tick to the SAME map as the bars", () => {
    const view = recoveryLogView();
    const { container } = renderCard(view);
    // A bar whose score IS the baseline average terminates exactly at the tick.
    // Rescaling the rail to the observed data range would desynchronise the two
    // silently, because the tick would still be drawn on the 0-100 scale.
    expect(Number.parseFloat(tick(container)!.style.bottom)).toBeCloseTo(
      railY(view.baseline!.recoveryScoreAvg!),
      5,
    );
  });

  it("draws no tick while the score baseline is still calibrating", () => {
    const { container } = renderCard(calibratingView());
    expect(tick(container)).toBeNull();
    // The scores exist even though the normal does not, so the bars still draw.
    expect(bars(container).length).toBeGreaterThan(0);
  });

  it("carries a text alternative rather than vanishing from the accessibility tree", () => {
    renderCard(recoveryLogView());
    const rail = screen.getByRole("img");
    expect(rail).toHaveAccessibleName(/14 days of recovery score/);
    expect(rail).toHaveAccessibleName(/12 with readings/);
    expect(rail).toHaveAccessibleName(/30-day average of 58/);
  });

  it("says so when there is no average to be read against", () => {
    renderCard(calibratingView());
    expect(screen.getByRole("img")).toHaveAccessibleName(/no 30-day average yet/);
  });

  it("sizes every mark by flex, so both breakpoints are the same DOM", () => {
    const { container } = renderCard(recoveryLogView());
    for (const mark of [...bars(container), ...ghosts(container)]) {
      expect(mark.className).toContain("flex-1");
      expect(mark.className).not.toMatch(/\bw-\d/);
    }
  });
});

describe("MorningLedgerCard — the detail rows", () => {
  it("shows exactly three mornings, newest first, with Today leading", () => {
    const { container } = renderCard(recoveryLogView());
    const detail = rows(container);
    expect(detail).toHaveLength(3);
    expect(detail.map((r) => fields(r)[0])).toEqual(["Today", "Mon", "Sun"]);
  });

  it("reads Recovery -> resting HR -> HRV, hero to footnote", () => {
    const { container } = renderCard(recoveryLogView());
    // Monday's rebound: 52, 47 bpm, 96.10188 ms.
    expect(fields(rows(container)[1])).toEqual(["Mon", "52", "Adequate", "47 bpm · 96 ms"]);
  });

  it("never prints a raw Whoop float — this is the wrap, and it is a bug", () => {
    const { container } = renderCard(recoveryLogView());
    expect(text(container)).not.toContain("96.10188");
    expect(text(container)).not.toContain("77.39185");
    expect(text(container)).toContain("96 ms");
  });

  it("rounds a non-integral recovery score for the same reason", () => {
    const view = recoveryLogView();
    const days = [...view.days!];
    days[days.length - 2] = { ...days[days.length - 2], recoveryScore: 52.4 };
    const { container } = renderCard({ ...view, days });
    expect(fields(rows(container)[1]).slice(0, 3)).toEqual(["Mon", "52", "Adequate"]);
    expect(text(container)).not.toContain("52.4");
  });

  it("carries no HRV delta glyph and no HRV status colour — that idiom is gone", () => {
    const { container } = renderCard(recoveryLogView());
    expect(text(container)).not.toMatch(/[▼▲▬]/);
    // `--accent` is the token only `hrvStatusColor` produces. This tile paints
    // no HRV status at all, so it must not appear anywhere in the markup.
    expect(container.innerHTML).not.toContain("var(--accent)");
  });

  it("renders a fully-null morning as one 'no reading' row", () => {
    const { container } = renderCard(recoveryLogView());
    expect(fields(rows(container)[0])).toEqual(["Today", "no reading"]);
    expect(screen.getAllByText("no reading")).toHaveLength(1);
  });

  it("keeps the three most recent calendar days even when all three are empty", () => {
    const { container } = renderCard(sparseView());
    expect(rows(container)).toHaveLength(3);
    expect(screen.getAllByText("no reading")).toHaveLength(3);
  });

  it("prints a dash and NO band word for a morning with readings but no score", () => {
    const { container } = renderCard(partialMorningView());
    const today = rows(container)[0];
    // `Today  No reading  54 bpm · 90 ms` is false: a missing score has no
    // band, and the honest rendering of that is silence, not a label.
    expect(fields(today)).toEqual(["Today", "—", "54 bpm · 91 ms"]);
    expect(text(today)).not.toMatch(/no reading/i);
  });

  it("sizes the figure group to its content, so it cannot wrap", () => {
    const { container } = renderCard(recoveryLogView());
    const groups = Array.from(container.querySelectorAll('[data-testid="detail-figures"]'));
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.className).toContain("ml-auto");
      expect(group.className).not.toMatch(/\bw-\d/);
    }
  });
});

describe("MorningLedgerCard — the states it has to survive", () => {
  it("full week: every position is a bar, and the tick still crosses them", () => {
    const view = recoveryLogView();
    // Today has landed and nothing in the window is missing — the clean case,
    // and the fixture the tick's contrast is judged on.
    const days = view.days!.map((d) =>
      d.recoveryScore === null ? { ...d, recoveryScore: 71, restingHr: 49, hrv: 94 } : d,
    );
    const { container } = renderCard({ ...view, days });
    expect(bars(container)).toHaveLength(RAIL_DAYS);
    expect(ghosts(container)).toHaveLength(0);
    expect(text(container)).not.toMatch(/no reading/i);
    expect(tick(container)).not.toBeNull();
  });

  it("red morning: today at 22 is one red bar and one red word, never a red row", () => {
    const view = recoveryLogView();
    const days = [...view.days!];
    days[days.length - 1] = {
      ...days[days.length - 1],
      restingHr: 63,
      recoveryScore: 22,
      hrv: 58,
    };
    const { container } = renderCard({ ...view, days });
    const today = rows(container)[0];
    expect(fields(today)).toEqual(["Today", "22", "Low", "63 bpm · 58 ms"]);
    expect(within(today).getByText("Low").style.color).toBe("var(--danger)");
    // Text and mark weight only: the row itself carries no fill of any kind.
    expect(today.getAttribute("style")).toBeNull();
  });

  it("is indifferent to the per-day band fields the sibling tiles care about", () => {
    const view = partialBandView();
    const stripped = {
      ...view,
      days: view.days!.map((d) => ({
        ...d,
        baselineAvg: null,
        balancedLow: null,
        balancedHigh: null,
        zScore: null,
        status: "unknown" as const,
      })),
    };
    const banded = render(<MorningLedgerCard section={view} href={HREF} />);
    const unbanded = render(<MorningLedgerCard section={stripped} href={HREF} />);
    // An uncalibrated day is an ORDINARY day here. This variant reads no per-day
    // band field, so stripping every one of them changes nothing on the card.
    expect(unbanded.container.innerHTML).toBe(banded.container.innerHTML);
  });

  it("reads as calibrating on a legacy payload with no derived blocks", () => {
    renderCard(legacyView());
    expect(screen.getByText("Log is calibrating.")).toBeInTheDocument();
  });
});
