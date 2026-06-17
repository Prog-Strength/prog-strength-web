/**
 * Reusable static mock primitives for the DX (macro table + macro rings).
 *
 * These are *proof elements* the ticket calls out explicitly — the macro
 * table must read cleanly and the rings carry the protein/fat/carb tints.
 * Keeping them as small shared pieces protects their legibility while each
 * variant still composes the surrounding chat/hero in its own way.
 */

import { macroRows, type MacroRow } from "./fixtures";

/** The lunch macro table. `density` tunes padding for tight vs. roomy hosts. */
export function MacroTable({ density = "comfortable" }: { density?: "tight" | "comfortable" }) {
  const pad = density === "tight" ? "px-2.5 py-1.5" : "px-3 py-2";
  const headPad = density === "tight" ? "px-2.5 py-1" : "px-3 py-1.5";
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-[var(--faint)]">
          <th className={`${headPad} font-semibold`}>Item</th>
          <th className={`${headPad} text-right font-semibold`}>Cal</th>
          <th
            className={`${headPad} text-right font-semibold`}
            style={{ color: "var(--macro-protein)" }}
          >
            P
          </th>
          <th
            className={`${headPad} text-right font-semibold`}
            style={{ color: "var(--macro-fat)" }}
          >
            F
          </th>
          <th
            className={`${headPad} text-right font-semibold`}
            style={{ color: "var(--macro-carb)" }}
          >
            C
          </th>
        </tr>
      </thead>
      <tbody>
        {macroRows.map((r: MacroRow) => (
          <tr
            key={r.item}
            className={
              r.total
                ? "border-t border-[var(--border-strong)] font-bold text-[var(--foreground)]"
                : "border-t border-[var(--border)] text-[var(--foreground)]"
            }
          >
            <td className={`${pad} ${r.total ? "font-bold" : "font-medium"}`}>{r.item}</td>
            <td className={`${pad} text-right tabular-nums`}>{r.cal}</td>
            <td
              className={`${pad} text-right tabular-nums`}
              style={{ color: "var(--macro-protein)" }}
            >
              {r.protein}
            </td>
            <td className={`${pad} text-right tabular-nums`} style={{ color: "var(--macro-fat)" }}>
              {r.fat}
            </td>
            <td className={`${pad} text-right tabular-nums`} style={{ color: "var(--macro-carb)" }}>
              {r.carb}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Ring = { label: string; value: number; goal: number; color: string };

const rings: Ring[] = [
  { label: "Protein", value: 36, goal: 160, color: "var(--macro-protein)" },
  { label: "Fat", value: 14, goal: 70, color: "var(--macro-fat)" },
  { label: "Carbs", value: 73, goal: 230, color: "var(--macro-carb)" },
];

/** Three macro progress rings — the nutrition proof element as a radial mock. */
export function MacroRings({ size = 76 }: { size?: number }) {
  const stroke = Math.max(6, Math.round(size * 0.11));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-wrap items-end justify-center gap-6">
      {rings.map((ring) => {
        const pct = Math.min(1, ring.value / ring.goal);
        return (
          <div key={ring.label} className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="var(--surface-3)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - pct)}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
                style={{ color: ring.color }}
              >
                {ring.value}g
              </div>
            </div>
            <span className="text-xs font-medium text-[var(--muted)]">{ring.label}</span>
          </div>
        );
      })}
    </div>
  );
}
