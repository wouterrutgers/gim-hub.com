import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fetchMemberSnapshots } from "../../api/requests/player-snapshot";

describe("fetchMemberSnapshots", function describeMemberSnapshots() {
  afterEach(function cleanup() {
    vi.restoreAllMocks();
  });

  it("maps server snapshots with raw diaries and empty collection and boss counts", async function testServerSnapshot() {
    const snapshot = {
      timestamp: 1789056000000,
      skills: { Attack: 100 },
      quests: { 0: "FINISHED" },
      diaries: [1],
      collection: [],
      bossKc: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ Alice: { lastVisit: snapshot, lastWeek: snapshot } }),
    );

    const snapshots = await fetchMemberSnapshots({
      baseURL: "/api",
      credentials: { name: "group", token: "token" },
      markers: {},
    });

    expect(snapshots.get("Alice").lastVisit.diaries.Ardougne.Easy.slice(0, 2)).toEqual([true, false]);
    expect(snapshots.get("Alice").lastVisit.collection).toEqual({});
    expect(snapshots.get("Alice").lastVisit.bossKc).toEqual({});
    expect(snapshots.get("Alice").lastWeek.skills.Attack).toBe(100);
  });

  it("returns no baselines when the server has no snapshots", async function testEmptySnapshots() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));

    const snapshots = await fetchMemberSnapshots({
      baseURL: "/api",
      credentials: { name: "group", token: "token" },
      markers: {},
    });

    expect(snapshots).toEqual(new Map());
  });
});
