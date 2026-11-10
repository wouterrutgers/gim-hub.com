import { describe, expect, it, vi } from "vite-plus/test";
import DemoClient from "../../api/demo-client";
import demoData from "../../api/demo-data.json";
import { createInitialState } from "../../api/demo/fixtures";
import { mockGroupDataResponse } from "../../api/demo/group-simulation";
import { populateActivity } from "../../api/demo/activity";

describe("demo client", function describeDemoClient() {
  it("pages complete player days and returns the whole day when demo activity changes", async function demoPlayerDays() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    const client = new DemoClient();
    vi.spyOn(client, "fetchGameData").mockResolvedValue({});
    const memberIdentifier = client.state.roster[0].id;

    for (let index = 0; index < 9; index++) {
      const start = new Date();
      start.setDate(start.getDate() - Math.max(0, index - 1));
      client.state.activities.set(index + 1, {
        id: index + 1,
        member_id: memberIdentifier,
        revision: 1,
        type: "xp",
        is_weekly: false,
        started_at: start.getTime(),
        occurred_at: start.getTime(),
        updated_at: Date.now(),
        data: { skills: { Attack: 100 } },
      });
    }

    const first = await client.fetchPlayerActivity({ memberIdentifier });
    expect(first.periods).toHaveLength(7);
    expect(first.periods[0].entries).toHaveLength(2);
    const older = await client.fetchPlayerActivity({ memberIdentifier, cursor: first.older_cursor });
    expect(older.periods).toHaveLength(1);
    expect(older.older_cursor).toBeNull();
    await vi.advanceTimersByTimeAsync(90_000);
    Object.assign(client.state.activities.get(1), {
      updated_at: Date.now(),
      revision: 2,
      data: { skills: { Attack: 200 } },
    });
    const updated = await client.fetchPlayerActivity({
      memberIdentifier,
      fromTime: new Date().toISOString(),
    });
    expect(updated.periods).toHaveLength(1);
    expect(updated.periods[0].entries).toHaveLength(2);
    expect(
      updated.periods[0].entries.reduce(function sum(total, entry) {
        return total + entry.data.skills.Attack;
      }, 0),
    ).toBe(300);
  });

  it("keeps demo activity attached to renamed members", async function testDemoActivity() {
    const client = new DemoClient();
    client.demoData = demoData;
    vi.spyOn(client, "fetchGameData").mockResolvedValue({});
    populateActivity(client.state);
    const original = await client.fetchActivity();
    const originalMember = client.state.roster.find(function originalName(member) {
      return member.displayName === "Cow31337Killer";
    });
    const originalEntries = original.entries.filter(function originalActivity(entry) {
      return entry.member_id === originalMember.id;
    });
    await client.renameGroupMember({ oldName: "Cow31337Killer", newName: "Test player" });
    const renamed = (await client.fetchGroupData()).find(function renamedMember(member) {
      return member.name === "Test player";
    });
    const response = await client.fetchActivity();
    expect(
      response.entries.filter(function member(entry) {
        return entry.member_id === renamed.id;
      }),
    ).toEqual(originalEntries);
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
