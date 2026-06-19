/** Throwaway shared glyphs for the steps-view DX variants. Stroke icons,
 * 1.75 weight, matching the activities surface. Duplication-friendly: any
 * variant may inline its own instead. */

type IconProps = { className?: string };

const base = (className = "h-4 w-4") => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function TargetIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function FootprintsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 16c-.5-2.5-.5-5 .5-7 1-2 3-2 3.5 0 .5 1.5 0 4-.5 6-.5 1.5-3 1.5-3.5 1z" />
      <path d="M4 20.5c0 1 1 1.5 2 1.5s2-.5 2-1.5V18H4v2.5z" />
      <path d="M20 11c.5-2.5.5-5-.5-7-1-2-3-2-3.5 0-.5 1.5 0 4 .5 6 .5 1.5 3 1.5 3.5 1z" />
      <path d="M20 15.5c0 1-1 1.5-2 1.5s-2-.5-2-1.5V13h4v2.5z" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
