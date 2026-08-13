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
        skills: new Array(skillsInBackendOrder.length).fill(0),
        quests: [0, 1, 2],
      },
    ]);

    expect(member.coordinates).toEqual({ x: 3200, y: 3201, plane: 1, isOnBoat: true });
    expect(member.lastUpdated).toEqual(new Date("2026-08-13T10:00:00.000Z"));
    expect(member.bank.get(995)).toEqual({ itemID: 995, quantity: 5 });
    expect(member.stats.run.current).toBe(87);
    expect(member.stats.specialAttack.current).toBe(42);
    expect(member.quests).toEqual(["IN_PROGRESS", "NOT_STARTED", "FINISHED"]);
  });

  it("rejects malformed API payloads", function testMalformedGroupData() {
    expect(function parseMalformedPayload() {
      parseGroupData([{ name: "Wise Old Man", stats: [90, 99, 50, 70, 8750, 99, 301] }]);
    }).toThrow("GetGroupData response payload was malformed.");
  });
});
