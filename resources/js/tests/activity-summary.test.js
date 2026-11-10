import { describe, expect, it } from "vite-plus/test";
import { summarizeActivity } from "../../game/activity-summary";

describe("player activity summaries", function activitySummaries() {
  it("combines skill and boss gains while keeping achievements and drop sources distinct", function dailySummary() {
    const entries = [
      { type: "xp", data: { skills: { Attack: 100, Hitpoints: 20 } } },
      { type: "xp", data: { skills: { Attack: 200 } } },
      { type: "level", data: { skill: "Attack", before: 70, after: 71 } },
      { type: "level", data: { skill: "Attack", before: 71, after: 72 } },
      { type: "boss", data: { boss: "Vorkath", count_type: "kill", count: 2, total_count: 100 } },
      { type: "boss", data: { boss: "Vorkath", count_type: "kill", count: 3, total_count: 103 } },
      { type: "boss", data: { boss: "Vorkath", count_type: "completion", count: 1, total_count: 1 } },
      { type: "quest", data: { quest_id: 17, quest_name: "Druidic Ritual" } },
      { type: "diary", data: { region: "Varrock", tier: "Easy", tasks: [0, 1], complete: false } },
      { type: "diary", data: { region: "Varrock", tier: "Easy", tasks: [1, 2], complete: false } },
      {
        type: "loot",
        data: { item_id: 4151, quantity: 1, value: 2_000_000, source: "Abyssal Sire", new_collection_item: false },
      },
      {
        type: "loot",
        data: { item_id: 4151, quantity: 1, value: 2_000_000, source: "Abyssal Sire", new_collection_item: true },
      },
      {
        type: "loot",
        data: { item_id: 4151, quantity: 1, value: 2_000_000, source: "Abyssal demon", new_collection_item: false },
      },
    ];
    const original = structuredClone(entries);
    const summary = new Map(summarizeActivity(entries, { items: new Map([[4151, { name: "Abyssal whip" }]]) }));

    expect(
      summary.get("Skills").map(function text(row) {
        return row.text;
      }),
    ).toEqual([
      expect.stringMatching(/Attack.*300/),
      expect.stringMatching(/Hitpoints.*20/),
      expect.stringMatching(/Attack.*70.*72/),
    ]);
    expect(
      summary.get("Boss kills").map(function text(row) {
        return row.text;
      }),
    ).toEqual([expect.stringMatching(/Vorkath.*5 kills/), expect.stringMatching(/Vorkath.*1 completion/)]);
    expect(summary.get("Quests")[0].text).toContain("Druidic Ritual");
    expect(summary.get("Achievement diaries")[0].text).toMatch(/Varrock.*3 tasks/);
    expect(
      summary.get("Drops").map(function text(row) {
        return row.text;
      }),
    ).toEqual([
      expect.stringMatching(/2.*Abyssal whip.*Abyssal Sire.*collection/i),
      expect.stringMatching(/Abyssal whip.*Abyssal demon/),
    ]);
    expect(entries).toEqual(original);
  });
});
