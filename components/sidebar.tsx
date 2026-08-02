"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { clearToken } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { useProfile } from "@/lib/profile-context";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  // When true, only highlight on an exact pathname match. The default
  // prefix-match behavior lights up the entry for nested routes (e.g.
  // /workouts/{id}), which is right for routes that own subpages but
  // wrong for parent entries that have a SIBLING entry below them in
  // NAV. Currently no sibling entries exist, but the flag is kept for
  // when one comes back.
  exact?: boolean;
};

const NAV: NavItem[] = [
  // Dashboard is the command-center landing: an at-a-glance overview of
  // the day plus the command bar. Authenticated users land here, so it
  // sits at the very top of the nav.
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  // Chat history used to be a sibling entry here; it now lives as the
  // persistent conversation-list pane inside the chat page so the
  // sidebar has one fewer row.
  { href: "/chat", label: "Chat", icon: <ChatIcon /> },
  // Timeline = the reverse-chronological feed of the user's own training
  // activity (completed workouts, imported runs, PRs, best efforts) with
  // reactions + comments. Slotted directly under Chat — both are
  // "what's happening" surfaces, distinct from the data-entry views below.
  { href: "/timeline", label: "Timeline", icon: <TimelineIcon /> },
  // Workouts and Running used to be separate siblings; they're now
  // consolidated into one Activities entry with URL-backed sub-views
  // (/activities?view=workouts|running). The active-highlight logic is
  // unchanged — /activities?view=… has pathname /activities so the
  // entry lights up regardless of the active sub-view.
  { href: "/activities", label: "Activities", icon: <ActivityIcon /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarIcon /> },
  // Pantry and Recipes live inside /nutrition as tabbed views, so the
  // sidebar surfaces only the parent entry.
  { href: "/nutrition", label: "Nutrition", icon: <PlateIcon /> },
  // Bodyweight pairs with nutrition — same conceptual "did I eat /
  // weigh the right amount today?" loop. Slotted right after the
  // food pair so the daily-tracking views cluster together.
  { href: "/bodyweight", label: "Bodyweight", icon: <ScaleIcon /> },
  // Blood Pressure sits right after Bodyweight — both are periodic
  // vital-sign logs whose value is the averaged trend over weeks.
  { href: "/blood-pressure", label: "Blood Pressure", icon: <HeartPulseIcon /> },
  { href: "/recovery", label: "Recovery", icon: <RecoveryIcon /> },
  // Progress = analysis layered on top of the logged data — slots
  // after the raw-data views (Activities/Calendar) since it depends
  // on them conceptually.
  { href: "/progress", label: "Progress", icon: <TrendingUpIcon /> },
  // Personal Records sits at the end as the "trophy case" view —
  // built on top of every other source of data in the app.
  { href: "/personal-records", label: "Personal Records", icon: <TrophyIcon /> },
  // Settings anchors the very bottom of the nav — a destination users
  // reach for occasionally (units, preferences), not a daily view.
  { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

const COLLAPSE_KEY = "ps_sidebar_collapsed";

/**
 * Persistent app-shell navigation. Rendered by the (app) layout so it
 * stays mounted across route changes — that means the collapse state
 * survives navigation without any context/provider plumbing.
 *
 * Active highlighting is exact-match plus a "prefix + slash" check so
 * future nested routes (e.g. /workouts/2026-05-17) still light up the
 * Workouts entry.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Restore persisted state on mount. There's an unavoidable flicker
  // here on first render (SSR can't read localStorage), but for a
  // sidebar that's fine — flicker is preferable to a cookie round-trip.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <aside
      className={`flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-150 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
        {collapsed ? (
          // Collapsed: the brand mark IS the toggle. The whole header
          // strip is too narrow (w-14 = 56px) to fit mark + chevron
          // side-by-side, and keeping the mark visible is more useful
          // than a chevron — users always see the brand identity, and
          // the same click still expands the sidebar.
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] transition hover:opacity-90"
          >
            <BrandMark size={20} />
          </button>
        ) : (
          <>
            {/* Expanded: a violet-tinted brand badge + two-line lockup are a
                Link home, and the collapse chevron lives on the right. */}
            <Link
              href="/chat"
              aria-label="Prog Strength home"
              className="flex min-w-0 items-center gap-2.5 transition hover:opacity-90"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <BrandMark size={20} />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold text-[var(--foreground)]">
                  Prog Strength
                </span>
                <span className="truncate text-[10px] font-semibold text-[var(--muted)]">
                  AI Coach
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronIcon direction="left" />
            </button>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              // Native browser tooltip when collapsed — cheap accessibility
              // for "what's this icon?" without bringing in a tooltip lib.
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <AccountAnchor collapsed={collapsed} onSignOut={logout} />
      </div>
    </aside>
  );
}

/**
 * Bottom-of-sidebar identity row: the user's avatar + display name, which
 * opens a small popover menu holding session actions (Sign out). Replaces
 * the bare Sign-out button — identity gets a home, and the menu keeps room
 * for future account actions.
 *
 * Accessibility: the trigger carries `aria-haspopup`/`aria-expanded`; the
 * menu closes on Escape and on a click outside, and focus-relevant
 * controls are real buttons. When the sidebar is collapsed the row shrinks
 * to just the avatar, but the menu still opens from it.
 */
function AccountAnchor({ collapsed, onSignOut }: { collapsed: boolean; onSignOut: () => void }) {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.display_name?.trim() || "Account";
  const avatarUrl = profile?.avatar_url ?? null;
  const email = profile?.email ?? null;

  // Close on Escape and on click/focus outside the anchor. Only wired
  // while the menu is open so the listeners don't run for every sidebar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          // Anchored above the row (the row sits at the very bottom of the
          // sidebar). mb-2 lifts it off the trigger.
          className="absolute bottom-full left-0 z-10 mb-2 min-w-[10rem] rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <SignOutIcon />
            </span>
            <span>Sign out</span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        title={collapsed ? displayName : undefined}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      >
        <Avatar url={avatarUrl} name={displayName} />
        {!collapsed && (
          <span className="flex min-w-0 flex-col leading-tight text-left">
            <span
              className="truncate text-sm font-semibold text-[var(--foreground)]"
              title={displayName}
            >
              {displayName}
            </span>
            {email && <span className="truncate text-[11px] text-[var(--muted)]">{email}</span>}
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * Circular avatar: the resolved image when present, otherwise an initials
 * placeholder (first two word-initials of the display name). Sized up to a
 * 32px circle to give the account card more presence at the foot of the rail.
 */
function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // Presigned S3 / OAuth URLs are arbitrary remote hosts; next/image
    // would require per-host remotePatterns config for a small 32px avatar.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name} avatar`}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold uppercase text-[var(--foreground)]"
    >
      {initials(name)}
    </span>
  );
}

/** First two word-initials of a name, e.g. "Sam Lifter" → "SL". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* --- Inline SVG icons --------------------------------------------------
 * Minimal stroke-only line icons. Inlined (rather than pulling in an
 * icon library) to keep the bundle small and the change focused. Sized
 * to 16x16 to fit the 20x20 hit area without crowding.
 */

function DashboardIcon() {
  // A 2×2 grid of rounded squares — the universal "dashboard / overview"
  // glyph. Reads as a panel of tiles, distinct from the Chat bubble below.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function TimelineIcon() {
  // A stack of feed "rows" — three left-aligned dots with trailing lines,
  // reading as an activity feed/timeline. Distinct from the Chat bubble
  // above it and the Activities pulse below it.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="6" r="1.5" />
      <path d="M10 6h10" />
      <circle cx="5" cy="12" r="1.5" />
      <path d="M10 12h10" />
      <circle cx="5" cy="18" r="1.5" />
      <path d="M10 18h10" />
    </svg>
  );
}

function ActivityIcon() {
  // Pulse/heartbeat waveform — the universal "activity" glyph. Anchors
  // the consolidated Activities entry (Workouts + Running + Overview).
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function TrendingUpIcon() {
  // Classic "up and to the right" line + arrowhead — the universal
  // shorthand for progress/growth charts.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

function TrophyIcon() {
  // Awards-style trophy — a cup with two side handles on a base.
  // Reads as "personal records" without using an emoji.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a2 2 0 0 0 0 4h3" />
      <path d="M16 6h3a2 2 0 0 1 0 4h-3" />
      <path d="M12 14v3" />
      <path d="M9 21h6" />
      <path d="M10 17h4l-1 4h-2l-1-4z" />
    </svg>
  );
}

function PlateIcon() {
  // Plate with fork + knife — reads as "meal / nutrition" without
  // an emoji. Concentric circles for the plate, two straight lines
  // flanking it for the utensils.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4v6" />
      <path d="M20 4v6" />
    </svg>
  );
}

function ScaleIcon() {
  // Bathroom-scale silhouette: rounded rectangle base with a small
  // round display lens inside. Reads as "scale / bodyweight" without
  // resorting to emoji.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3" />
      <path d="M9 10h6" />
    </svg>
  );
}

function HeartPulseIcon() {
  // A heart with an ECG/pulse notch cutting through it — reads as
  // "blood pressure / cardiovascular vital" without an emoji. The heart
  // is the standard two-lobe path; the zigzag is a short baseline that
  // dips and spikes across its middle.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 1.3.5 2.5 1.3 3.4H8l1.5-2.5 2 4 1.5-2.5h5.5c.8-.9 1.3-2.1 1.3-3.4Z" />
      <path d="M4.5 12H8l1.5-2.5 2 4 1.5-2.5h6.5" />
    </svg>
  );
}

function RecoveryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 8.5a4.5 4.5 0 0 0-8.5-2 4.5 4.5 0 0 0-8.5 2c0 1.6 1 3.2 2.6 4.6H9l1.5-2.5 2 4 1.5-2.5h4.4C19.5 11.7 20.5 10.1 20.5 8.5Z" />
    </svg>
  );
}

function SettingsIcon() {
  // Standard gear: a center hub plus eight short teeth. The universal
  // shorthand for settings/preferences.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M4.9 4.9l2.1 2.1" />
      <path d="M17 17l2.1 2.1" />
      <path d="M19.1 4.9L17 7" />
      <path d="M7 17l-2.1 2.1" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
