import { describe, expect, it } from "vitest";
import {
  SCOPE_RECONNECT_LINE,
  SLEEP_RECONNECT_CTA,
  SLEEP_RECONNECT_LINE,
  SLEEP_RECONNECT_REASON,
  missingAnyScope,
  missingSleepScope,
  underScopedLine,
} from "./whoop";
import type { WhoopConnection } from "./api";

const connected = (missing?: string[]): WhoopConnection => ({
  status: "connected",
  ...(missing === undefined ? {} : { missing_scopes: missing }),
});

describe("missingSleepScope", () => {
  it("is true only when the sleep scope itself is absent", () => {
    expect(missingSleepScope(connected(["read:sleep"]))).toBe(true);
    expect(missingSleepScope(connected(["read:cycles", "read:sleep"]))).toBe(true);
  });

  it("is false for a connection missing some OTHER scope", () => {
    // The bug this exists to stop: a user whose sleep ingests fine being told
    // to reconnect to enable sleep tracking they already have.
    expect(missingSleepScope(connected(["read:workout"]))).toBe(false);
    expect(missingSleepScope(connected(["read:workout", "read:body_measurement"]))).toBe(false);
  });

  it("is false for an empty array, an absent key, and no connection", () => {
    expect(missingSleepScope(connected([]))).toBe(false);
    expect(missingSleepScope(connected())).toBe(false);
    expect(missingSleepScope(null)).toBe(false);
    expect(missingSleepScope(undefined)).toBe(false);
  });

  it("is false unless the connection is CONNECTED — capability is not lifecycle", () => {
    expect(missingSleepScope({ status: "error", missing_scopes: ["read:sleep"] })).toBe(false);
    expect(missingSleepScope({ status: "revoked", missing_scopes: ["read:sleep"] })).toBe(false);
    expect(missingSleepScope({ status: "absent", missing_scopes: ["read:sleep"] })).toBe(false);
  });
});

describe("missingAnyScope", () => {
  it("is true for any missing scope on a connected connection", () => {
    expect(missingAnyScope(connected(["read:sleep"]))).toBe(true);
    expect(missingAnyScope(connected(["read:workout"]))).toBe(true);
  });

  it("is false with nothing missing, and for a connection that is not connected", () => {
    expect(missingAnyScope(connected([]))).toBe(false);
    expect(missingAnyScope(connected())).toBe(false);
    expect(missingAnyScope({ status: "error", missing_scopes: ["read:sleep"] })).toBe(false);
  });
});

describe("underScopedLine", () => {
  it("names sleep when sleep is what is missing", () => {
    expect(underScopedLine(connected(["read:sleep"]))).toBe(SLEEP_RECONNECT_LINE);
    expect(SLEEP_RECONNECT_LINE).toContain(SLEEP_RECONNECT_CTA);
    expect(SLEEP_RECONNECT_LINE).toContain(SLEEP_RECONNECT_REASON);
  });

  it("falls back to a truthful generic sentence for any other scope", () => {
    expect(underScopedLine(connected(["read:workout"]))).toBe(SCOPE_RECONNECT_LINE);
    expect(SCOPE_RECONNECT_LINE).not.toContain("sleep");
  });

  it("never prints a scope name — they are not user-facing nouns", () => {
    for (const line of [SLEEP_RECONNECT_LINE, SCOPE_RECONNECT_LINE]) {
      expect(line).not.toContain("read:");
    }
  });
});
