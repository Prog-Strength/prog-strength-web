export function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 transition ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-line)]"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--faint)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
