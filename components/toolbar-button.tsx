/**
 * Ghost-style button. When `active` is true (used by the Pantry and
 * Recipes tabs), the button paints a 2px underline that aligns with
 * the parent row's bottom border, so the active tab visually
 * "connects" to the separator below.
 */
export function ToolbarButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-label keeps the control discoverable when the visible
      // text label is hidden below sm:. Padding deliberately stays
      // at 0 here: the active state's `pb-3 -mb-[14px] border-b-2`
      // math depends on the button having no base padding so the
      // 12px bottom padding + 14px negative margin together align
      // the underline with the parent row's bottom border. A
      // p-1.5 sm:p-0 attempt (or any p-* shorthand) gets overridden
      // by the responsive `sm:p-0` after the active class's pb-3,
      // which both drifts the underline and makes the button appear
      // to "depress" on click. Icon-only is a comfortable tap target
      // on mobile without extra padding.
      aria-label={label}
      className={
        "inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70 " +
        (active ? "border-b-2 border-[var(--foreground)] -mb-[14px] pb-3" : "")
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
