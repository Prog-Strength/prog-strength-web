import type { ReactNode } from "react";

/**
 * One row in the editorial feature stack: a one-line benefit paired with a
 * small mock/screenshot, image-left on even rows and image-right on odd
 * (alternation driven by `index`). Each row picks up its own macro/activity
 * tint as a subtle section accent — an eyebrow label and a soft hairline —
 * unified by the violet CTAs above and below.
 *
 * At narrow widths the two columns collapse to a single stacked column
 * (mock above copy) rather than breaking — the reflow the SOW calls for.
 */
export function FeatureRow({
  index,
  eyebrow,
  title,
  body,
  tint,
  mock,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  /** Section accent token, e.g. `var(--macro-protein)`; null for the chat
   * row, which carries the full macro palette inside its own mock. */
  tint: string | null;
  mock: ReactNode;
}) {
  const imageRight = index % 2 === 1;

  return (
    <section className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
      {/* Mock. On desktop it sits left by default, right on odd rows via
          order; on mobile it always stacks above the copy. */}
      <div className={imageRight ? "md:order-2" : ""}>{mock}</div>

      <div className={`flex flex-col gap-3 ${imageRight ? "md:order-1" : ""}`}>
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={tint ? { color: tint } : { color: "var(--accent)" }}
        >
          {eyebrow}
        </span>
        <h2 className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="text-pretty text-base text-[var(--muted)]">{body}</p>
        <span
          className="mt-1 h-1 w-12 rounded-[var(--radius-pill)]"
          style={{ backgroundColor: tint ?? "var(--accent)" }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
