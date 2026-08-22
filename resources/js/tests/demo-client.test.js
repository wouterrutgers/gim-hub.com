import { describe, expect, it, vi } from "vite-plus/test";
import DemoClient from "../../api/demo-client";
import demoData from "../../api/demo-data.json";
import { createInitialState } from "../../api/demo/fixtures";
import { mockGroupDataResponse } from "../../api/demo/group-simulation";
import { createSkillsSnapshot } from "../../api/demo/snapshot-history";
import { skills } from "../../game/skill";

describe("demo client", function describeDemoClient() {
  it("creates skill snapshots in domain order", function testSkillSnapshot() {
    const skillExperience = Object.fromEntries(
      skills.map(function createSkillExperience(skill) {
        return [skill, 100];
      }),
    );
    const snapshot = createSkillsSnapshot(skillExperience, { Attack: 25 });

    expect(snapshot.Attack).toBe(75);
    expect(snapshot.Defence).toBe(100);
  });

  it("creates isolated initial simulation state", function testInitialState() {
    const firstState = createInitialState();
    const secondState = createInitialState();

    firstState.roster[0].displayName = "Renamed";
    firstState.banks.set("Thurgo", new Map());

    expect(secondState.roster[0].displayName).toBe("Thurgo");
    expect(secondState.banks.has("Thurgo")).toBe(false);
  });

  it("creates a complete simulated group response", function testGroupResponse() {
    const requestTime = new Date();
    const response = mockGroupDataResponse(createInitialState(), performance.now(), demoData);

    expect(
      response.map(function getMemberName(member) {
        return member.name;
      }),
    ).toEqual(["Thurgo", "Cow31337Killer", "Gary", "xXgamerXx", "@SHARED"]);
    expect(
      response.find(function findCowKiller(member) {
        return member.name === "Cow31337Killer";
      }).skills,
    ).toBeDefined();
    expect(
      response
        .filter(function filterSharedBank(member) {
          return member.name !== "@SHARED";
        })
        .every(function isOnline(member) {
          return member.lastOnlineAt >= requestTime;
        }),
    ).toBe(true);
  });

  it("retries initialization after a failure", async function testInitializationRetry() {
    const client = new DemoClient();
    vi.spyOn(client, "initialize").mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({});

    await expect(client.fetchGameData()).rejects.toThrow("Unavailable");
    await expect(client.fetchGameData()).resolves.toEqual({});
    expect(client.initialize).toHaveBeenCalledTimes(2);
  });
});
