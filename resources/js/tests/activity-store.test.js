// @vitest-environment jsdom
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { useActivityStore } from "../../stores/activity";

function response(entries) {
  return { entries, older_cursor: null, from_time: new Date().toISOString() };
}
function entry(id, revision, amount, memberIdentifier = 1) {
  return {
    id,
    revision,
    member_id: memberIdentifier,
    started_at: Date.now(),
    occurred_at: Date.now(),
    type: "xp",
    data: { skills: { Attack: amount } },
  };
}

describe("activity store", function activityStore() {
  it("replaces cached sessions with weekly history without losing another player's activity", function weeklyHistory() {
    const store = useActivityStore(createTestPinia());
    const recordedAt = Date.parse("2026-09-13T23:59:59.000Z");
    const original = { ...entry(1, 1, 100), started_at: recordedAt, occurred_at: recordedAt };
    const teammate = { ...original, id: 2, member_id: 2 };
    const summary = {
      ...original,
      id: 3,
      is_weekly: true,
      started_at: Date.parse("2026-09-07T00:00:00.000Z"),
      data: { skills: { Attack: 250 } },
    };
    store.mergeEntries([original, teammate]);
    store.mergeEntries([summary]);
    store.mergeEntries([original]);

    expect(store.entries).toHaveLength(2);
    expect(
      store.entries.find(function archived(activity) {
        return activity.member_id === 1;
      }),
    ).toEqual(summary);
    expect(
      store.entries.find(function otherPlayer(activity) {
        return activity.member_id === 2;
      }),
    ).toEqual(teammate);
  });

  it("recovers polling and updates existing cards without accepting stale totals", async function recoverActivity() {
    vi.useFakeTimers();
    const client = {
      fetchActivity: vi
        .fn()
        .mockRejectedValueOnce(new Error("Unavailable"))
        .mockResolvedValueOnce(response([entry(1, 2, 200)]))
        .mockResolvedValue(response([entry(1, 1, 100)])),
    };
    const pinia = createTestPinia();
    useApiStore(pinia).client = client;
    const store = useActivityStore(pinia);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].data.skills.Attack).toBe(200);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.entries[0].data.skills.Attack).toBe(200);
    expect(store.loaded).toBe(true);
  });

  it("ignores late responses after switching groups", async function switchGroups() {
    vi.useFakeTimers();
    let resolveOld;
    const old = {
      fetchActivity: vi.fn(function pending() {
        return new Promise(function capture(resolve) {
          resolveOld = resolve;
        });
      }),
    };
    const next = { fetchActivity: vi.fn().mockResolvedValue(response([entry(2, 1, 50, 2)])) };
    const pinia = createTestPinia();
    const api = useApiStore(pinia);
    api.client = old;
    const store = useActivityStore(pinia);
    await vi.advanceTimersByTimeAsync(0);
    api.client = next;
    await vi.advanceTimersByTimeAsync(0);
    resolveOld(response([entry(1, 1, 100)]));
    await vi.advanceTimersByTimeAsync(0);
    expect(
      store.entries.map(function member(activity) {
        return activity.member_id;
      }),
    ).toEqual([2]);
  });
});
