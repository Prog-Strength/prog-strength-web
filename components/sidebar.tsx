"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";

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
  // Chat history used to be a sibling entry here; it now lives as a
  // drawer inside the chat page so the sidebar has one fewer row.
  { href: "/chat", label: "Chat", icon: <ChatIcon /> },
  // Workouts and Running used to be separate siblings; they're now
  // consolidated into one Activities entry with URL-backed sub-views
  // (/activities?view=workouts|running). The active-highlight logic is
  // unchanged — /activities?view=… has pathname /activities so the
  // entry lights up regardless of the active sub-view.
  { href: "/activities", label: "Activities", icon: <ActivityIcon /> },
  { href: "/exercises", label: "Exercises", icon: <CatalogIcon /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarIcon /> },
  // Pantry and Recipes live inside /nutrition as tabbed views, so the
  // sidebar surfaces only the parent entry.
  { href: "/nutrition", label: "Nutrition", icon: <PlateIcon /> },
  // Bodyweight pairs with nutrition — same conceptual "did I eat /
  // weigh the right amount today?" loop. Slotted right after the
  // food pair so the daily-tracking views cluster together.
  { href: "/bodyweight", label: "Bodyweight", icon: <ScaleIcon /> },
  // Progress = analysis layered on top of the logged data — slots
  // after the raw-data views (Workouts/Calendar) and the reference
  // catalog (Exercises) since it depends on all three conceptually.
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
            className="mx-auto flex items-center justify-center rounded p-1 text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
          >
            <BrandMark size={22} />
          </button>
        ) : (
          <>
            {/* Expanded: brand mark + wordmark are a Link home, and the
                collapse chevron lives on the right. */}
            <Link
              href="/chat"
              aria-label="Prog Strength home"
              className="flex min-w-0 items-center gap-2 text-[var(--foreground)] transition hover:opacity-80"
            >
              <BrandMark size={22} className="shrink-0" />
              <span className="truncate text-sm font-semibold">Prog Strength</span>
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
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition ${
                active
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={logout}
          title={collapsed ? "Sign out" : undefined}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <SignOutIcon />
          </span>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

/* --- Inline SVG icons --------------------------------------------------
 * Minimal stroke-only line icons. Inlined (rather than pulling in an
 * icon library) to keep the bundle small and the change focused. Sized
 * to 16x16 to fit the 20x20 hit area without crowding.
 */

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

function CatalogIcon() {
  // A short stack of "book spines" — reads as a library/catalog at
  // 16x16 better than a bulleted-list icon does, and visually distinct
  // from the Workouts dumbbell and Calendar grid.
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
      <rect x="3" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="17" y="4" width="4" height="16" rx="1" />
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
