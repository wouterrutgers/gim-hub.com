// @vitest-environment jsdom

import { describe, expect, it, vi } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { useGroupStore } from "../../stores/group";
import { useSnapshotStore } from "../../stores/snapshots";

describe("snapshot store", function describeSnapshotStore() {
  it("resumes retries when a member starts uploading skills and stops when their baseline arrives", async function testNewMemberBaseline() {
    vi.useFakeTimers();
    const snapshot = {
      timestamp: Date.now(),
      skills: { Attack: 100 },
      quests: {},
      diaries: {},
      collection: {},
      bossKc: {},
    };
    const baselines = { lastVisit: snapshot, lastWeek: snapshot };
    let snapshots = new Map([["Alice", baselines]]);
    const members = [
      { name: "Alice", skills: { Attack: 150 }, lastUpdated: new Date() },
      { name: "Inactive", skills: { Attack: 100 }, lastUpdated: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
      { name: "New player" },
      { name: "@SHARED" },
    ];
    const client = {
      credentials: { name: "Test group", token: "test token" },
      async fetchGameData() {
        return { quests: new Map() };
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchGroupData() {
        return members;
      },
      fetchMemberSnapshots: vi.fn(async function fetchMemberSnapshots() {
        return snapshots;
      }),
    };
    const pinia = createTestPinia();
    useApiStore(pinia).client = client;
    useGroupStore(pinia);
    await vi.advanceTimersByTimeAsync(0);
    const snapshotStore = useSnapshotStore(pinia);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.fetchMemberSnapshots).toHaveBeenCalledOnce();

    members[2] = { name: "New player", skills: { Attack: 150 }, lastUpdated: new Date() };
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshotStore.getBaselineSnapshot("New player")).toBeUndefined();

    snapshots = new Map([
      ["Alice", baselines],
      ["New player", baselines],
    ]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snapshotStore.getBaselineSnapshot("New player").snapshot.skills.Attack).toBe(100);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.fetchMemberSnapshots).toHaveBeenCalledTimes(3);
  });
});
