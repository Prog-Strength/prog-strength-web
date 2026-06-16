/**
 * Shared inline icon set for the 12 nav destinations, keyed by NavKey.
 * Stroke-only line icons that inherit `currentColor`, so each variant
 * tints/sizes them via its own className. Kept in one place so the *nav
 * identity* is constant across variants and only the chrome around it
 * diverges. (The macro table, bubbles, composer, etc. are each variant's
 * own — only these wayfinding glyphs are shared.)
 */
import type { NavKey } from "./fixtures";

export function NavIcon({ k, size = 18 }: { k: NavKey; size?: number }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (k) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <circle cx="5" cy="6" r="1.5" />
          <path d="M10 6h10" />
          <circle cx="5" cy="12" r="1.5" />
          <path d="M10 12h10" />
          <circle cx="5" cy="18" r="1.5" />
          <path d="M10 18h10" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
      );
    case "activities":
      return (
        <svg {...common}>
          <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
        </svg>
      );
    case "exercises":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="4" height="16" rx="1" />
          <rect x="10" y="7" width="4" height="13" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "nutrition":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 4v6" />
          <path d="M20 4v6" />
        </svg>
      );
    case "bodyweight":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <circle cx="12" cy="13" r="3" />
          <path d="M9 10h6" />
        </svg>
      );
    case "progress":
      return (
        <svg {...common}>
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="14 7 21 7 21 14" />
        </svg>
      );
    case "records":
      return (
        <svg {...common}>
          <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
          <path d="M8 6H5a2 2 0 0 0 0 4h3" />
          <path d="M16 6h3a2 2 0 0 1 0 4h-3" />
          <path d="M12 14v3" />
          <path d="M9 21h6" />
          <path d="M10 17h4l-1 4h-2l-1-4z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
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
}
