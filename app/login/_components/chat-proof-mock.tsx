import { chatProof, type MacroRow } from "../_fixtures";

/**
 * The proof element: the turkey-burger → macro-table exchange rendered as
 * a static chat snippet. Showing the AI do the thing — parse a plain
 * sentence into a logged meal with a macro breakdown — beats describing it
 * in prose, so this is the most polished of the landing mocks and the one
 * that must stay legible at every width.
 *
 * It mirrors the real chat surface: a violet user bubble, then an assistant
 * card (raised slate) carrying a `✓ Log Consumption` tool chip, a "via
 * Sonnet 4.6" attribution, the macro table with protein/fat/carb tints and
 * a bold Total row, and a coach-tone closing line. All static — no API.
 */
export function ChatProofMock() {
  const { userMessage, model, toolName, items, total, closing } = chatProof;

  return (
    <div className="flex w-full flex-col gap-3 rounded-[var(--radius-card-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {/* User line — violet accent bubble, right-aligned like the real chat. */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-[var(--radius-card)] rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-sm text-[var(--accent-fg)]">
          {userMessage}
        </p>
      </div>

      {/* Assistant card — raised slate, with the tool chip + attribution. */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] rounded-bl-md border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] ring-1 ring-[var(--accent-line)]">
            <span aria-hidden="true">✓</span> {toolName}
          </span>
          <span className="text-[11px] text-[var(--faint)]">via {model}</span>
        </div>

        <MacroTable items={items} total={total} />

        <p className="text-sm text-[var(--muted)]">{closing}</p>
      </div>
    </div>
  );
}

/**
 * The macro table: columns Item · Cal · P · F · C, per-item rows, then a
 * bold Total. Protein/fat/carb figures carry their macro tint so the
 * breakdown reads at a glance. Rendered as a real `<table>` for semantics
 * and so the numbers line up via `tabular-nums` at any width.
 */
function MacroTable({ items, total }: { items: readonly MacroRow[]; total: MacroRow }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full border-collapse text-left text-xs tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th scope="col" className="px-3 py-2 font-semibold">
              Item
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Cal
            </th>
            <th
              scope="col"
              className="px-2 py-2 text-right font-semibold text-[var(--macro-protein)]"
            >
              P
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold text-[var(--macro-fat)]">
              F
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-[var(--macro-carb)]">
              C
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.item} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 font-medium text-[var(--foreground)]">{row.item}</td>
              <td className="px-2 py-2 text-right text-[var(--muted)]">{row.cal}</td>
              <td className="px-2 py-2 text-right text-[var(--macro-protein)]">{row.protein}g</td>
              <td className="px-2 py-2 text-right text-[var(--macro-fat)]">{row.fat}g</td>
              <td className="px-3 py-2 text-right text-[var(--macro-carb)]">{row.carb}g</td>
            </tr>
          ))}
          <tr className="border-t border-[var(--border-strong)] bg-[var(--surface-2)] font-semibold">
            <td className="px-3 py-2 text-[var(--foreground)]">{total.item}</td>
            <td className="px-2 py-2 text-right text-[var(--foreground)]">{total.cal}</td>
            <td className="px-2 py-2 text-right text-[var(--macro-protein)]">{total.protein}g</td>
            <td className="px-2 py-2 text-right text-[var(--macro-fat)]">{total.fat}g</td>
            <td className="px-3 py-2 text-right text-[var(--macro-carb)]">{total.carb}g</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
