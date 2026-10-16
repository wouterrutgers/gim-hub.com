import { describe, expect, it, vi } from "vite-plus/test";
import DemoClient from "../../api/demo-client";
import demoData from "../../api/demo-data.json";
import { createInitialState } from "../../api/demo/fixtures";
import { mockGroupDataResponse } from "../../api/demo/group-simulation";
import { populateActivity } from "../../api/demo/activity";

describe("demo client", function describeDemoClient() {
  it("keeps demo activity attached to renamed members", async function testDemoActivity() {
    const client = new DemoClient();
    client.demoData = demoData;
    vi.spyOn(client, "fetchGameData").mockResolvedValue({});
    populateActivity(client.state);
    const original = await client.fetchActivity();
    await client.renameGroupMember({ oldName: "Cow31337Killer", newName: "Test player" });
    const renamed = (await client.fetchGroupData()).find(function renamedMember(member) {
      return member.name === "Test player";
    });
    const response = await client.fetchActivity();
    expect(
      response.entries.filter(function member(entry) {
        return entry.member_id === renamed.id;
      }).length,
    ).toBe(2);
    expect(response.entries).toEqual(original.entries);
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

  it("keeps reordered members in subsequent demo group responses", async function testReorderedGroupResponse() {
    const client = new DemoClient();
    client.demoData = demoData;
    vi.spyOn(client, "fetchGameData").mockResolvedValue({});
    const initialMembers = await client.fetchGroupData();

    await client.reorderGroupMembers(["Gary", "Thurgo", "Cow31337Killer", "xXgamerXx"]);

    const members = await client.fetchGroupData();
    expect(members.map(({ name }) => name)).toEqual(["Gary", "Thurgo", "Cow31337Killer", "xXgamerXx", "@SHARED"]);

    for (const member of members) {
      expect(member.id).toBe(initialMembers.find(({ name }) => name === member.name).id);
    }
  });

  it("retries initialization after a failure", async function testInitializationRetry() {
    const client = new DemoClient();
    vi.spyOn(client, "initialize").mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({});

    await expect(client.fetchGameData()).rejects.toThrow("Unavailable");
    await expect(client.fetchGameData()).resolves.toEqual({});
    expect(client.initialize).toHaveBeenCalledTimes(2);
  });
});
