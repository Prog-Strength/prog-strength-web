/**
 * Render-time parsing of a timeline card's pre-formatted `content.metrics`
 * strings into big value + small label pairs for the card's stat row. The
 * API sends already-formatted, sometimes-compound strings (e.g.
 * "12 sets · 8,400 lb"); we split on the middot and lift a leading numeric
 * value off each token so the card can show a bold numeral with an uppercase
 * unit beneath. Anything we can't split cleanly renders value-only — never a
 * crash, never a dropped stat. Pure: no backend involved.
 */
export type Stat = { value: string; label: string };

// Leading value = digits with separators / colons / dots / slashes; the rest
// (after optional whitespace) is the label/unit.
const VALUE_RE = /^([\d][\d.,:/]*)\s*(.*)$/;

export function parseStats(metrics: string[]): Stat[] {
  const out: Stat[] = [];
  for (const raw of metrics) {
    for (const part of raw.split("·")) {
      const token = part.trim();
      if (!token) continue;
      const m = VALUE_RE.exec(token);
      if (m) {
        out.push({ value: m[1], label: m[2].trim() });
      } else {
        out.push({ value: token, label: "" });
      }
    }
  }
  return out;
}
