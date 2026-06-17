/// <reference types="vitest/globals" />
import { parseStats, type Stat } from "./statRow";

describe("parseStats", () => {
  it("splits a compound metric on the middot into separate stats", () => {
    expect(parseStats(["12 sets · 8,400 lb"])).toEqual<Stat[]>([
      { value: "12", label: "sets" },
      { value: "8,400", label: "lb" },
    ]);
  });

  it("keeps a time/value with no unit as a value-only stat", () => {
    expect(parseStats(["5.0 mi · 41:12"])).toEqual<Stat[]>([
      { value: "5.0", label: "mi" },
      { value: "41:12", label: "" },
    ]);
  });

  it("handles a bare single metric", () => {
    expect(parseStats(["142 bpm"])).toEqual<Stat[]>([{ value: "142", label: "bpm" }]);
  });

  it("flattens multiple metric entries and drops blanks", () => {
    expect(parseStats(["10 sets", "", "  ", "3,000 lb"])).toEqual<Stat[]>([
      { value: "10", label: "sets" },
      { value: "3,000", label: "lb" },
    ]);
  });

  it("falls back to value-only when there is no numeric prefix", () => {
    expect(parseStats(["easy run"])).toEqual<Stat[]>([{ value: "easy run", label: "" }]);
  });
});
