"use client";

/**
 * The ledger — register 4 of the `/recovery` deck, and the reason the page
 * exists at all.
 *
 * Everything above this is a shape: three plots that answer *how have I been*
 * in a glance. The ledger answers the other question, the one a chart cannot —
 * *what was the number on the 6th of March* — and it answers it over ALL STORED
 * HISTORY, not over the window the deck happens to be drawing. A user who opens
 * a page whose job is history and depth must be able to REACH March, so the
 * rows are every morning the strap ever recorded, newest first, twenty to a
 * page (`LEDGER_PAGE_SIZE`, the bodyweight readings table's figure), with a
 * pager in that table's register.
 *
 * ── CORRECTION 3 — IT OPENS ON PAGE 1.
 *
 * The DX mockup initialises its page state to `4`. That was a fixture staging
 * device — the DX required each variant to render a MID-STATE page rather than
 * a pristine one — and it is not behaviour. Production opens on page 1, the
 * newest mornings, which is what a user asking "how was last week" needs to see
 * without touching anything. The mid-state is exercised by `ledger.test.tsx`
 * and by the user clicking `Next`.
 *
 * PAGING IS CONTROLLED — the owner holds the number and passes it down. That is
 * not ceremony either: the crosshair up on the deck can select a morning that
 * lives on page 11, and a ledger that owned its own page would be free to jump
 * there on its own. It must not. Selecting a morning never silently re-pages the
 * ledger underneath the user's hands; the off-page selection surfaces a quiet
 * accent link that OFFERS the move, and only a click takes it.
 *
 * Rows come from `ledgerRows`, which drops the mornings Whoop never recorded.
 * The plots do the opposite on purpose — a hollow slot is what makes an absence
 * visible on an axis — but the record has nothing to record. A morning with SOME
 * metrics is kept and prints `—` (via `round(null)`) for the ones that are
 * missing.
 *
 * Nothing here recomputes a server figure: this register rounds values for
 * display, ranks a score into Whoop's fixed thirds via `recoveryBand`, and
 * slices an array into pages.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";
import {
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
  round,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { useIsMobile } from "@/lib/use-is-mobile";
import { LEDGER_PAGE_SIZE, ledgerRows, longDate, pageCount, pageOf, shortDate } from "./shared";

/** The page's 10px uppercase label, shared by the header strip and the columns. */
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]";

/**
 * The four columns, at two sizes.
 *
 * THE ROW IS A STRICT 30px AND THAT IS THE POINT. The uniform rhythm is one of
 * the three properties that distinguish this variant — 400 mornings scan as a
 * ruled column, and a row that grew by a line wherever a date was long would
 * turn the ledger back into a list. So mobile keeps all FOUR columns and pays
 * for the width by shrinking: 11px figures and `shortDate` ("12 Aug") instead of
 * `longDate` ("Wed 12 Aug"). The alternative the SOW offers — dropping `bpm` and
 * `ms` onto a second line — buys legibility at the cost of the one thing this
 * register is for, and on the surface that must be reachable on a phone.
 */
const COLS_DESKTOP = "grid-cols-[1fr_64px_56px_56px]";
const COLS_MOBILE = "grid-cols-[1fr_52px_44px_44px]";

export type LedgerProps = {
  /** ALL stored history, oldest → newest. Not the deck's window. */
  days: RecoveryDayPoint[];
  /** The morning the crosshair has selected, or null. */
  selectedDate: string | null;
  /** 1-indexed, owned by the caller. */
  page: number;
  onPage: (p: number) => void;
};

export function Ledger({ days, selectedDate, page, onPage }: LedgerProps) {
  const isMobile = useIsMobile();
  const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const pad = isMobile ? "px-3" : "px-4";
  const figure = isMobile ? "text-[11px]" : "text-[12px]";

  const rows = ledgerRows(days);
  const totalPages = pageCount(rows.length);
  // Clamp for DISPLAY only. If the owner's page outruns a shortened history the
  // ledger shows the last real page rather than an empty grid; correcting the
  // owner's state from inside a render is not this component's business.
  const current = Math.min(Math.max(1, page), totalPages);
  const pageRows = pageOf(rows, current);

  // The count is of REAL ROWS. `days` is date-aligned and materialized by the
  // endpoint, so a window wider than the user's history arrives padded with
  // empty slots — counting those would tell a user with three months of strap
  // data that they have a year of mornings.
  const recorded = rows.length;

  const selectedIndex = selectedDate === null ? -1 : rows.findIndex((r) => r.date === selectedDate);
  const selectedPage = selectedIndex < 0 ? null : Math.floor(selectedIndex / LEDGER_PAGE_SIZE) + 1;
  // The selection is a real row, and it is not on the page being read.
  const elsewhere = selectedPage !== null && selectedPage !== current;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <div
        className={`flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 ${pad}`}
      >
        <span className={LABEL}>Ledger · all stored history</span>
        {recorded > 0 && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
            {recorded} morning{recorded === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className={`grid ${cols} border-b border-[var(--border)] py-1.5 ${pad}`}>
        <span className={LABEL}>Date</span>
        <span className={`text-right ${LABEL}`}>Score</span>
        <span className={`text-right ${LABEL}`}>bpm</span>
        <span className={`text-right ${LABEL}`}>ms</span>
      </div>

      {recorded === 0 ? (
        // One quiet line rather than an empty grid with column headings over it.
        <p className={`py-4 text-[11px] text-[var(--faint)] ${pad}`}>
          No mornings recorded yet — the ledger fills in one row per night.
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {pageRows.map((row) => (
            <LedgerRow
              key={row.date}
              row={row}
              selected={row.date === selectedDate}
              cols={cols}
              pad={pad}
              figure={figure}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {elsewhere && selectedDate !== null && selectedPage !== null && (
        <div className={`border-t border-[var(--border)] py-1.5 ${pad}`}>
          <button
            type="button"
            onClick={() => onPage(selectedPage)}
            className="text-[11px] text-[var(--accent)] transition hover:opacity-80"
          >
            {shortDate(selectedDate)} is on page{" "}
            <span className="font-mono tabular-nums">{selectedPage}</span> →
          </button>
        </div>
      )}

      {/* One page needs no pager — the bodyweight table's posture. A `Page 1 of 1`
          beside two dead buttons is furniture for a control with nothing to do. */}
      {totalPages > 1 && (
        <div
          className={`flex items-center justify-between gap-3 border-t border-[var(--border)] py-2 ${pad}`}
        >
          <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
            Page {current} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <PagerButton label="Prev" disabled={current <= 1} onClick={() => onPage(current - 1)} />
            <PagerButton
              label="Next"
              disabled={current >= totalPages}
              onClick={() => onPage(current + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One morning. The selected row takes `--accent-soft` and a 2px `--accent-line`
 * rule at its left edge — a fill and an edge, never a colour change to the
 * figures, which stay readable as themselves.
 */
function LedgerRow({
  row,
  selected,
  cols,
  pad,
  figure,
  isMobile,
}: {
  row: RecoveryDayPoint;
  selected: boolean;
  cols: string;
  pad: string;
  figure: string;
  isMobile: boolean;
}) {
  const band = recoveryBand(row.recoveryScore);
  const color = recoveryBandColor(band);

  return (
    <div
      data-testid="ledger-row"
      className={`relative grid h-[30px] ${cols} items-center ${pad} ${
        selected ? "bg-[var(--accent-soft)]" : ""
      }`}
    >
      {selected && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[var(--accent-line)]"
          aria-hidden="true"
        />
      )}
      <span className={`truncate ${figure} text-[var(--foreground)]`}>
        {isMobile ? shortDate(row.date) : longDate(row.date)}
      </span>
      <span className="text-right">
        <span
          className="inline-flex min-w-[36px] justify-center rounded-[var(--radius-pill)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            color,
          }}
          title={recoveryBandWord(band)}
        >
          {round(row.recoveryScore)}
        </span>
      </span>
      <span className={`text-right font-mono ${figure} tabular-nums text-[var(--muted)]`}>
        {round(row.restingHr)}
      </span>
      <span className={`text-right font-mono ${figure} tabular-nums text-[var(--muted)]`}>
        {round(row.hrv)}
      </span>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-default disabled:opacity-35 disabled:hover:text-[var(--muted)]"
    >
      {label}
    </button>
  );
}
