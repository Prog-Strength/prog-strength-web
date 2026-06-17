/**
 * Tiny inline-SVG glyph set shared by the DX variants. THROWAWAY mockup
 * helpers — stroke-based, `currentColor`, sized via the `s` prop. These exist
 * so the tri-state encoding never depends on colour alone (a run carries a
 * route glyph, a lift a dumbbell glyph, a planned session a clock, a
 * done-from-plan a check) — legible to a colour-blind eye too.
 */
import type { CSSProperties } from "react";
import type { Discipline, EventState } from "./fixtures";

type IconProps = { s?: number; className?: string; style?: CSSProperties };

const base = (s: number): CSSProperties => ({
  width: s,
  height: s,
  display: "inline-block",
  flexShrink: 0,
});

export function RunGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <circle cx="16" cy="4.5" r="1.6" />
      <path d="M5 21l3.5-5 2-4 4 2 2 4" />
      <path d="M9.5 12l2.5-3 3 1 2.5-1" />
      <path d="M4 11l3-1 2.5 2" />
    </svg>
  );
}

export function LiftGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

export function ClockGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CheckGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function ChevronLeft({ s = 16, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRight({ s = 16, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function PlusGlyph({ s = 16, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PencilGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M14 4l6 6L9 21H3v-6L14 4z" />
      <path d="M12.5 5.5l6 6" />
    </svg>
  );
}

export function CloseGlyph({ s = 16, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PlayGlyph({ s = 14, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      style={{ ...base(s), ...style }}
      className={className}
      aria-hidden
    >
      <path d="M7 4.5l13 7.5-13 7.5z" />
    </svg>
  );
}

export function GoogleGlyph({ s = 13, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base(s), ...style }} className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.66-.06-1.3-.17-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.74 3-4.3 3-7.2z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.2-2.5c-.9.6-2.04.95-3.42.95-2.62 0-4.84-1.77-5.64-4.15H3.05v2.6A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.36 13.88a6 6 0 0 1 0-3.76v-2.6H3.05a10 10 0 0 0 0 8.96l3.31-2.6z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.84-2.84A10 10 0 0 0 12 2 10 10 0 0 0 3.05 7.52l3.31 2.6C7.16 7.74 9.38 5.98 12 5.98z"
      />
    </svg>
  );
}

export function DisciplineGlyph({
  d,
  s,
  style,
}: {
  d: Discipline;
  s?: number;
  style?: CSSProperties;
}) {
  return d === "run" ? <RunGlyph s={s} style={style} /> : <LiftGlyph s={s} style={style} />;
}

/** State badge glyph: planned = clock, completed-planned = check, logged = discipline. */
export function StateGlyph({
  d,
  state,
  s,
  style,
}: {
  d: Discipline;
  state: EventState;
  s?: number;
  style?: CSSProperties;
}) {
  if (state === "planned") return <ClockGlyph s={s} style={style} />;
  if (state === "completed-planned") return <CheckGlyph s={s} style={style} />;
  return <DisciplineGlyph d={d} s={s} style={style} />;
}
