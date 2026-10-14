import { describe, expect, it } from "vite-plus/test";
import { activityIsLive } from "../../game/activity";

describe("activity stretches", function activityStretches() {
  it("closes XP and boss stretches at their different inactivity boundaries", function inactivityBoundaries() {
    const start = 1_000_000;
    expect(activityIsLive({ type: "xp", occurred_at: start }, start + 15 * 60_000 - 1)).toBe(true);
    expect(activityIsLive({ type: "xp", occurred_at: start }, start + 15 * 60_000)).toBe(false);
    expect(activityIsLive({ type: "boss", occurred_at: start }, start + 29 * 60_000)).toBe(true);
    expect(activityIsLive({ type: "boss", occurred_at: start }, start + 30 * 60_000)).toBe(false);
  });
});
