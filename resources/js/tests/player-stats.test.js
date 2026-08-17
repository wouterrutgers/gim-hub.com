// @vitest-environment jsdom

import { createPinia } from "pinia";
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import PlayerStats from "../../components/player-panel/PlayerStats.vue";
import { useApiStore } from "../../stores/api";

describe("player stats", function describePlayerStats() {
  let app;

  afterEach(function cleanup() {
    app?.unmount();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("expires stale interactions and online status as time passes", async function testTimeBasedStatuses() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async function fetchImageChunk() {
        return {
          ok: true,
          async json() {
            return { "/ui/player-icon.webp": "/hashed/ui/player-icon.webp" };
          },
        };
      }),
    );

    const lastUpdated = new Date();
    let isInitialRequest = true;
    const client = {
      fetchGameData: vi.fn(async function fetchGameData() {
        return { quests: new Map() };
      }),
      fetchGroupCollectionLogs: vi.fn(async function fetchGroupCollectionLogs() {
        return new Map();
      }),
      fetchGroupData: vi.fn(async function fetchGroupData() {
        const member = {
          name: "Test player",
          lastUpdated,
          lastOnlineAt: lastUpdated,
        };

        if (isInitialRequest) {
          isInitialRequest = false;

          return [
            {
              ...member,
              interacting: {
                name: "Moonlight moth",
                lastUpdated,
              },
            },
          ];
        }

        return [member];
      }),
    };
    const pinia = createPinia();
    const apiStore = useApiStore(pinia);
    apiStore.client = client;
    const container = document.createElement("div");
    document.body.append(container);
    app = createApp(PlayerStats, { member: "Test player" });
    app.use(pinia);
    app.mount(container);

    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(container.querySelector(".player-interacting")?.textContent).toBe("Moonlight moth");
    expect(container.textContent).toContain("Online");

    await vi.advanceTimersByTimeAsync(30_000);
    await nextTick();
    expect(container.querySelector(".player-interacting")).toBeNull();
    expect(container.textContent).toContain("Online");

    await vi.advanceTimersByTimeAsync(270_000);
    await nextTick();
    expect(container.textContent).toContain("Last online");
  });
});
