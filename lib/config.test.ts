import { describe, expect, it } from "vitest";
import { envFlag } from "./config";

describe("envFlag", () => {
  // The whole point: a flag set to any truthy spelling on Vercel must enable a
  // gate written in code, so the two can't silently disagree (the bug that left
  // a DX preview 404ing because the env said "true" and the code checked "1").
  it.each(["1", "true", "TRUE", "True", "yes", "on", " true "])("treats %j as enabled", (v) =>
    expect(envFlag(v)).toBe(true),
  );

  it.each(["0", "false", "no", "off", "", "  ", "enabled", undefined])(
    "treats %j as disabled",
    (v) => expect(envFlag(v)).toBe(false),
  );
});
