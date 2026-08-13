import { describe, expect, it } from "vite-plus/test";
import { computeActivity } from "../../game/player-activity";

describe("player activity", function describePlayerActivity() {
  it("compares current member data with a snapshot", function testActivityComparison() {
    const snapshot = {
      timestamp: 123,
      skills: { Attack: 100 },
      quests: { 1: "NOT_STARTED" },
      diaries: {},
      collection: { 995: 2 },
    };
    const activity = computeActivity(snapshot, {
      skills: { Attack: 150 },
      quests: new Map([[1, "FINISHED"]]),
      collection: new Map([[995, 5]]),
    });

    expect(activity.skillChanges[0]).toMatchObject({
      skill: "Attack",
      experienceBefore: 100,
      experienceAfter: 150,
    });
    expect(activity.questChanges[0]).toMatchObject({ questId: 1, statusAfter: "FINISHED" });
    expect(activity.collectionChanges[0]).toMatchObject({ itemId: 995, quantityBefore: 2, quantityAfter: 5 });
  });
});
