// @vitest-environment jsdom

import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import PlayerPanel from "../../components/player-panel/PlayerPanel.vue";
import { useApiStore } from "../../stores/api";
import { useGroupStore } from "../../stores/group";

describe("player panel", function describePlayerPanel() {
  it("shows recent activity when failed and empty snapshot loads recover", async function testActivityRecovery() {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(function suppressSnapshotError() {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async function fetchImageChunk() {
        return Response.json({});
      }),
    );

    const player = "Test player";
    const snapshot = {
      timestamp: Date.now() - 60_000,
      skills: { Attack: 100 },
      quests: {},
      diaries: {},
      collection: {},
      bossKc: {},
    };
    const snapshots = new Map([[player, { lastVisit: snapshot, lastWeek: snapshot }]]);
    const client = {
      credentials: { name: "Test group", token: "test token" },
      async fetchGameData() {
        return { quests: new Map() };
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchGroupData() {
        return [{ name: player, skills: { Attack: 150 }, lastUpdated: new Date() }];
      },
      async fetchMemberHiscores() {
        return new Map();
      },
      fetchMemberSnapshots: vi
        .fn()
        .mockRejectedValueOnce(new Error("Snapshot request failed"))
        .mockResolvedValueOnce(new Map())
        .mockResolvedValue(snapshots),
    };
    const pinia = createTestPinia();
    useApiStore(pinia).client = client;
    useGroupStore(pinia);
    await vi.advanceTimersByTimeAsync(0);
    const container = document.createElement("div");
    document.body.append(container);
    const application = createTestApplication(PlayerPanel, { member: player });
    application.use(pinia);
    application.mount(container);

    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelector('button[aria-label="View recent activity"]')).toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(container.querySelector('button[aria-label="View recent activity"]')).toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(container.querySelector('button[aria-label="View recent activity"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(container.querySelector('button[aria-label="View recent activity"]')).not.toBeNull();
    expect(client.fetchMemberSnapshots).toHaveBeenCalledTimes(3);
  });
});
