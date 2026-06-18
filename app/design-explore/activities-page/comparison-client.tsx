"use client";

import { useState } from "react";
import { EditorialVariant } from "./_variants/editorial";
import { WhoopVariant } from "./_variants/whoop";
import { BrutalistVariant } from "./_variants/brutalist";
import { StravaVariant } from "./_variants/strava";
import { OuraVariant } from "./_variants/oura";

/**
 * Comparison harness for the activities-page DX. Stacks all five variants on
 * one screen, each in a labeled frame with an anchor, behind a sticky idiom
 * nav. Throwaway: no shared design abstraction with the variants on purpose —
 * divergence is the goal, so each variant owns its entire visual world.
 */

type Entry = {
  id: string;
  idiom: string;
  reference: string;
  distinct: string;
  Component: () => React.JSX.Element;
};

// Ticket order. The id doubles as the in-page anchor.
const VARIANTS: Entry[] = [
  {
    id: "editorial-data-journalism",
    idiom: "editorial-data-journalism",
    reference: "The Athletic",
    distinct:
      "Oversized serif figures, captioned charts, one restrained accent — training as a data story.",
    Component: EditorialVariant,
  },
  {
    id: "whoop-recovery-dense",
    idiom: "whoop-recovery-dense",
    reference: "Whoop",
    distinct:
      "One signal-color gradient across a tight gauge grid — training as a readiness readout.",
    Component: WhoopVariant,
  },
  {
    id: "brutalist-terminal",
    idiom: "brutalist-terminal",
    reference: "Bloomberg Terminal",
    distinct: "Monospace tabular grid, hairlines, color only as state — training as a ledger.",
    Component: BrutalistVariant,
  },
  {
    id: "strava-vibrant",
    idiom: "strava-vibrant",
    reference: "Strava / Nike Run Club",
    distinct: "Gradient heroes, multi-accent per domain, two-tone charts — training as energy.",
    Component: StravaVariant,
  },
  {
    id: "oura-calm-minimal",
    idiom: "oura-calm-minimal",
    reference: "Oura / Linear",
    distinct:
      "Desaturated low-contrast, fine type, delicate line charts — training as a calm instrument.",
    Component: OuraVariant,
  },
];

export function ComparisonClient() {
  const [active, setActive] = useState<string>(VARIANTS[0].id);

  return (
    <div
      style={{
        fontFamily: "var(--dx-font-inter), system-ui, sans-serif",
        color: "#e6e7ea",
      }}
    >
      {/* Harness chrome — not part of any variant. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(12,13,16,0.85)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <PMark />
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>
            Design Exploration
          </span>
          <span style={{ fontSize: 13, color: "#8b8f98" }}>
            activities-page · 5 variants ·{" "}
            <strong style={{ color: "#c7a3ff" }}>DO NOT MERGE</strong>
          </span>
        </div>
        <nav style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {VARIANTS.map((v) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              onClick={() => setActive(v.id)}
              style={{
                fontSize: 12,
                padding: "5px 11px",
                borderRadius: 999,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.1)",
                color: active === v.id ? "#0c0d10" : "#b9bcc4",
                background: active === v.id ? "#c7a3ff" : "transparent",
                fontWeight: 600,
                transition: "background 0.15s",
              }}
            >
              {v.idiom}
            </a>
          ))}
        </nav>
      </header>

      <main
        style={{ display: "flex", flexDirection: "column", gap: 56, padding: "32px 20px 120px" }}
      >
        {VARIANTS.map((v, i) => (
          <section key={v.id} id={v.id} style={{ scrollMarginTop: 96 }}>
            <div style={{ maxWidth: 1180, margin: "0 auto" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    color: "#6b7280",
                    fontWeight: 700,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
                  {v.idiom}
                </h2>
                <span style={{ fontSize: 12, color: "#8b8f98" }}>
                  draws on <strong style={{ color: "#c7a3ff" }}>{v.reference}</strong>
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#8b8f98", margin: "0 0 16px", maxWidth: 720 }}>
                {v.distinct}
              </p>
              {/* The variant owns everything inside this frame: palette, type, chrome. */}
              <div
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
                }}
              >
                <v.Component />
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

// The "P" brand mark — a Fixed Point that survives in every variant; shown
// here once in the harness chrome too.
function PMark() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 6,
        background: "#c7a3ff",
        color: "#0c0d10",
        fontWeight: 900,
        fontSize: 14,
        lineHeight: 1,
      }}
    >
      P
    </span>
  );
}
