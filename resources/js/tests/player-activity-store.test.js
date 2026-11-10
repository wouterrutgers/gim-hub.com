// @vitest-environment jsdom
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { usePlayerActivityStore } from "../../stores/player-activity";

function response(quantity, revision = 1) {
  const timestamp = Date.parse("2026-09-13T12:00:00Z");

  return {
    periods: [
      {
        key: "day:1",
        kind: "day",
        started_at: timestamp,
        ended_at: timestamp + 86_400_000,
        entries: [
          {
            id: 1,
            member_id: 10,
            type: "xp",
            revision,
            started_at: timestamp,
            occurred_at: timestamp,
            data: { skills: { Attack: quantity } },
          },
        ],
      },
    ],
    older_cursor: "earlier",
    from_time: new Date().toISOString(),
  };
}

describe("player activity store", function playerActivityStore() {
  it("replaces complete periods without double counting revisions and drops detailed entries when they are archived", async function changedPeriods() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    const latest = response(200, 2);
    const weekly = response(1000, 1);
    weekly.periods[0] = {
      ...weekly.periods[0],
      key: "week:1",
      kind: "week",
      started_at: Date.parse("2026-09-07T00:00:00Z"),
    };
    const client = {
      fetchPlayerActivity: vi
        .fn()
        .mockResolvedValueOnce(latest)
        .mockResolvedValueOnce(response(100, 1))
        .mockResolvedValueOnce(weekly),
    };
    useApiStore(pinia).client = client;
    const store = usePlayerActivityStore(pinia);
    store.selectedMember = 10;
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);

    expect(store.periods[0].entries).toHaveLength(1);
    expect(store.periods[0].entries[0].data.skills.Attack).toBe(200);
    expect(store.olderCursor).toBe("earlier");
    expect(client.fetchPlayerActivity.mock.calls[1][0].fromTime).toBe(latest.from_time);

    await vi.advanceTimersByTimeAsync(5000);
    expect(store.periods).toHaveLength(1);
    expect(store.periods[0].kind).toBe("week");
  });

  it("ignores pending history after switching players or groups and retries a failed player request", async function switchPlayers() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    let finishFirst;
    let finishHistory;
    const client = {
      fetchPlayerActivity: vi
        .fn()
        .mockImplementationOnce(function pending() {
          return new Promise(function capture(resolve) {
            finishFirst = resolve;
          });
        })
        .mockResolvedValueOnce(response(200))
        .mockImplementationOnce(function pendingHistory() {
          return new Promise(function capture(resolve) {
            finishHistory = resolve;
          });
        }),
    };
    const api = useApiStore(pinia);
    api.client = client;
    const store = usePlayerActivityStore(pinia);
    store.selectedMember = 10;
    store.selectedMember = 20;
    await vi.advanceTimersByTimeAsync(0);
    finishFirst(response(100));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.periods[0].entries[0].data.skills.Attack).toBe(200);
    const history = store.loadOlder();
    api.client = {
      fetchPlayerActivity: vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue(response(300)),
    };
    finishHistory(response(50));
    await history;
    await vi.advanceTimersByTimeAsync(0);
    expect(store.periods).toHaveLength(0);
    expect(store.error).not.toBe("");
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.error).toBe("");
    expect(store.periods[0].entries[0].data.skills.Attack).toBe(300);
  });
});
