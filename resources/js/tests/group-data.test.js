import { describe, expect, it } from "vite-plus/test";
import { parseGroupData, skillsInBackendOrder } from "../../api/requests/group-data";

describe("parseGroupData", function describeParseGroupData() {
  it("validates and maps API payloads to domain values", function testGroupDataMapping() {
    const [member] = parseGroupData([
      {
        name: "Wise Old Man",
        coordinates: [3200, 3201, 1, 1],
        last_updated: "2026-08-13T10:00:00.000Z",
        bank: [995, 2, 995, 3],
        stats: [90, 99, 50, 70, 8750, 100, 301, 42],
        skills: [123, 456, ...new Array(skillsInBackendOrder.length - 3).fill(0), 789],
        quests: [0, 1, 2],
      },
    ]);

    expect(member.coordinates).toEqual({ x: 3200, y: 3201, plane: 1, isOnBoat: true });
    expect(member.lastUpdated).toEqual(new Date("2026-08-13T10:00:00.000Z"));
    expect(member.bank.get(995)).toEqual({ itemID: 995, quantity: 5 });
    expect(member.stats.run.current).toBe(87);
    expect(member.stats.specialAttack.current).toBe(42);
    expect(member.skills.Agility).toBe(123);
    expect(member.skills.Attack).toBe(456);
    expect(member.skills.Sailing).toBe(789);
    expect(member.quests).toEqual(["IN_PROGRESS", "NOT_STARTED", "FINISHED"]);
  });

  it.each([
    ["missing special attack", [90, 99, 50, 70, 8750, 100, 301]],
    ["additional stat", [90, 99, 50, 70, 8750, 100, 301, 42, 1]],
    ["invalid run maximum", [90, 99, 50, 70, 8750, 99, 301, 42]],
  ])("rejects stats with %s", function testMalformedGroupData(reason, stats) {
    expect(function parseMalformedPayload() {
      parseGroupData([{ name: "Wise Old Man", stats }]);
    }).toThrow("GetGroupData response payload was malformed.");
  });
});
