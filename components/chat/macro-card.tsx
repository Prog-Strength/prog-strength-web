/**
 * A nutrition macro card rendered in place of a plain GFM table when the
 * assistant emits one. `parseMacroTable` is the pure detector/extractor —
 * it inspects the table's headers, decides whether the table is "about
 * macros" (protein/carbs/fat columns), and normalizes the cells into a
 * typed shape the card can render. Anything that doesn't look like a
 * macro table returns null so the markdown renderer falls back to its
 * plain styled `<table>`.
 */

export type MacroRow = {
  label: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};
export type ParsedMacros = { items: MacroRow[]; total: MacroRow };

function num(cell: string): number | null {
  const cleaned = cell.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function colIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  // Single-letter aliases match exactly only — a bare "c"/"f"/"p" header.
  // Allowing startsWith for them would let "Calories" satisfy the carb
  // lookup ("c"), stealing the calorie column. Multi-char aliases keep
  // the prefix match so "Protein (g)" still resolves to "protein".
  return lower.findIndex((h) => aliases.some((a) => h === a || (a.length > 1 && h.startsWith(a))));
}
export function parseMacroTable(headers: string[], rows: string[][]): ParsedMacros | null {
  const pIdx = colIndex(headers, ["protein", "p"]);
  const cIdx = colIndex(headers, ["carb", "carbs", "carbohydrate", "c"]);
  const fIdx = colIndex(headers, ["fat", "f"]);
  const present = [pIdx, cIdx, fIdx].filter((i) => i >= 0).length;
  if (present < 2) return null;
  const calIdx = colIndex(headers, ["calorie", "calories", "kcal", "cal"]);
  const labelIdx = 0;
  const toRow = (cells: string[]): MacroRow => ({
    label: (cells[labelIdx] ?? "").trim(),
    calories: calIdx >= 0 ? num(cells[calIdx] ?? "") : null,
    protein: pIdx >= 0 ? num(cells[pIdx] ?? "") : null,
    carbs: cIdx >= 0 ? num(cells[cIdx] ?? "") : null,
    fat: fIdx >= 0 ? num(cells[fIdx] ?? "") : null,
  });
  const all = rows.map(toRow);
  const isTotal = (r: MacroRow) => /^(total|totals|sum|daily total)$/i.test(r.label.trim());
  const totalRow = all.find(isTotal);
  const items = all.filter((r) => !isTotal(r));
  if (items.length === 0) return null;
  const sum = (key: "calories" | "protein" | "carbs" | "fat") => {
    const vals = items.map((r) => r[key]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const total: MacroRow = totalRow ?? {
    label: "Total",
    calories: sum("calories"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
  };
  return { items, total };
}

/** "—" when null, otherwise the number formatted with a trailing unit. */
function fig(value: number | null, suffix = ""): string {
  return value == null ? "—" : `${value}${suffix}`;
}

export function MacroCard({ parsed }: { parsed: ParsedMacros }) {
  const { items, total } = parsed;
  return (
    <div className="my-2 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-soft)] first:mt-0 last:mb-0">
      <ul className="divide-y divide-[var(--border)]">
        {items.map((row, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 truncate text-xs font-medium text-[var(--foreground)]">
              {row.label || "—"}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[var(--muted)]">
              {row.calories != null && <span className="mr-2">{fig(row.calories)} cal</span>}
              {fig(row.protein, "g")} P · {fig(row.carbs, "g")} C · {fig(row.fat, "g")} F
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-[var(--foreground)]">{total.label}</span>
          {total.calories != null && (
            <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">
              {fig(total.calories)} cal
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-[var(--macro-protein-bg)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--macro-protein)]">
            {fig(total.protein, "g")} P
          </span>
          <span className="rounded-full bg-[var(--macro-fat-bg)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--macro-fat)]">
            {fig(total.fat, "g")} F
          </span>
          <span className="rounded-full bg-[var(--macro-carb-bg)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--macro-carb)]">
            {fig(total.carbs, "g")} C
          </span>
        </div>
      </div>
    </div>
  );
}
