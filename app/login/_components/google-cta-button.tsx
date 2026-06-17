/**
 * The "Continue with Google" CTA — the single auth action on the landing
 * page, reused at the top (in the hero) and bottom (closing CTA) of the
 * scroll. There is no second auth path; this is the only way in.
 *
 * The OAuth wiring is unchanged from the original login card: the parent
 * computes `loginHref` client-side from `window.location.origin` and the
 * configured API URL, and passes it down. Until `return_to` resolves the
 * href is `null`, and the button renders **disabled and not-yet-ready**
 * (never broken) — it can't be clicked into a half-formed OAuth URL.
 *
 * The multicolor Google "G" and the "No password to manage." reassurance
 * are fixed trust signals; only their presentation is styled here.
 */
export function GoogleCtaButton({
  loginHref,
  /** Visually larger treatment for the primary hero CTA. */
  size = "default",
}: {
  loginHref: string | null;
  size?: "default" | "lg";
}) {
  const ready = Boolean(loginHref);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <a
        href={loginHref ?? "#"}
        aria-disabled={!ready}
        tabIndex={ready ? undefined : -1}
        className={`flex w-full items-center justify-center gap-3 rounded-[var(--radius-pill)] bg-[var(--accent)] font-semibold text-[var(--accent-fg)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-line)] ${
          size === "lg" ? "px-6 py-3.5 text-base" : "px-5 py-3 text-sm"
        } ${ready ? "" : "pointer-events-none cursor-not-allowed opacity-60"}`}
      >
        {/* Inline SVG (not next/image) so there's one fewer asset to ship.
            White disc keeps the multicolor "G" legible on the violet fill. */}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
          <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"
            />
          </svg>
        </span>
        Continue with Google
      </a>

      <p className="text-center text-xs text-[var(--muted)]">
        We use Google sign-in to identify you. No password to manage.
      </p>
    </div>
  );
}
