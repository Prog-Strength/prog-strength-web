/// <reference types="vitest/globals" />
import { activityDetailHref } from "@/lib/activity-route";

describe("activityDetailHref", () => {
  it("routes a hiking session to the hike detail page", () => {
    expect(activityDetailHref({ id: "h-1", activity_type: "hiking" })).toBe("/hiking/h-1");
  });

  it("routes a running session to the run detail page", () => {
    expect(activityDetailHref({ id: "r-1", activity_type: "running" })).toBe("/running/r-1");
  });

  it("falls back to the run detail page for types without their own surface", () => {
    expect(activityDetailHref({ id: "w-1", activity_type: "walking" })).toBe("/running/w-1");
  });
});
