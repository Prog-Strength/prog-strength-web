/**
 * The Prog Strength "P" mark. Inlined as SVG (not next/image) so it
 * inherits text color via `currentColor` — that way each surface
 * controls whether the mark is white, muted, or accent-tinted just by
 * setting its own `className`. The viewBox is the source 1254x1254
 * square; sizing is purely from the `size` prop in px.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 1254 1254"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M 1093 339 L 1000 245 L 358 245 L 451 332 L 207 1011 L 460 782 L 504 658 L 847 658 L 1020 536 Z M 551 514 L 597 388 L 913 389 L 877 484 L 822 516 L 553 516 Z"
      />
    </svg>
  );
}
