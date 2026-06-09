"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getMe, updateMe } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useToast } from "@/components/toast";
import { UsageBar } from "@/components/usage-bar";

/**
 * Settings. A "Units" section with two segmented controls: distance
 * (wired to the DistanceUnitContext, which persists to the server and
 * localStorage) and weight (read from / written to the user's profile
 * via GET/PATCH /me).
 */
export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { unit, setUnit } = useDistanceUnit();

  const [weightUnit, setWeightUnit] = useState<"lb" | "kg" | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe(token)
      .then((u) => setWeightUnit(u.weight_unit))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
        }
      });
  }, [router]);

  function changeWeightUnit(next: "lb" | "kg") {
    if (next === weightUnit) return;
    const prev = weightUnit;
    setWeightUnit(next); // optimistic
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    updateMe(token, { weight_unit: next }).catch((err: unknown) => {
      setWeightUnit(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update weight unit");
    });
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Usage</h2>

            <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <p className="text-sm font-medium">Daily AI allowance</p>
              <UsageBar />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">Units</h2>

            <SettingRow
              label="Distance"
              description="Used across the Running views for distances and paces."
            >
              <SegmentedControl
                value={unit}
                options={[
                  { value: "mi", label: "Miles" },
                  { value: "km", label: "Kilometers" },
                ]}
                onChange={setUnit}
              />
            </SettingRow>

            <SettingRow label="Weight" description="Used for bodyweight and workout volume.">
              <SegmentedControl
                value={weightUnit ?? "lb"}
                disabled={weightUnit === null}
                options={[
                  { value: "lb", label: "Pounds" },
                  { value: "kg", label: "Kilograms" },
                ]}
                onChange={changeWeightUnit}
              />
            </SettingRow>
          </section>
        </div>
      </div>
    </main>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Two-option segmented toggle. The active option gets the accent fill;
 * the rest read as muted. Matches the app's pill/toggle styling.
 */
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
