import { describe, expect, it } from "vite-plus/test";
import { activityIsLive, activityPresentation } from "../../game/activity";
import bossIcons from "../../assets/data/boss_icons.json";

describe("activity stretches", function activityStretches() {
  it("closes XP and boss stretches at their different inactivity boundaries", function inactivityBoundaries() {
    const start = 1_000_000;
    expect(activityIsLive({ type: "xp", occurred_at: start }, start + 15 * 60_000 - 1)).toBe(true);
    expect(activityIsLive({ type: "xp", occurred_at: start }, start + 15 * 60_000)).toBe(false);
    expect(activityIsLive({ type: "boss", occurred_at: start }, start + 29 * 60_000)).toBe(true);
    expect(activityIsLive({ type: "boss", occurred_at: start }, start + 30 * 60_000)).toBe(false);
  });

  it("uses the base raid icon for entry mode and the specific icon for expert mode", function raidIcons() {
    function raidPresentation(boss) {
      return activityPresentation(
        { type: "boss", data: { boss, count: 1, count_type: "completion", total_count: 1 } },
        {},
      );
    }

    expect(raidPresentation("Tombs of Amascut: Entry Mode").icon).toBe(bossIcons["Tombs of Amascut"]);
    expect(raidPresentation("Tombs of Amascut: Expert Mode").icon).toBe(bossIcons["Tombs of Amascut: Expert Mode"]);
  });
});
