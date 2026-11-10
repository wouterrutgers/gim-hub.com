// @vitest-environment jsdom
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import ActivityFeed from "../../components/player-activity/ActivityFeed.vue";
import { useApiStore } from "../../stores/api";
import { useActivityStore } from "../../stores/activity";
import { useImageStore } from "../../stores/images";
import { activityWeek } from "../../game/activity";

function playerHistory(entries) {
  return {
    periods: [{ key: "day:1", kind: "day", started_at: Date.now(), ended_at: Date.now() + 86_400_000, entries }],
    older_cursor: null,
    from_time: new Date().toISOString(),
  };
}

describe("activity feed", function activityFeed() {
  it("clears excluded players when switching groups and shows the new group's comparison", async function switchGroups() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
      return path;
    });

    function groupClient(memberId, name) {
      return {
        async fetchGameData() {
          return { quests: new Map(), items: new Map(), diaries: new Map() };
        },
        async fetchGroupData() {
          return [{ id: memberId, name }];
        },
        async fetchGroupCollectionLogs() {
          return new Map();
        },
        async fetchPlayerActivity() {
          const response = await this.fetchActivity();

          return playerHistory(response.entries);
        },
        async fetchActivity() {
          return {
            entries: [
              {
                id: memberId,
                member_id: memberId,
                revision: 1,
                type: "xp",
                started_at: Date.now(),
                occurred_at: Date.now(),
                data: { skills: { Attack: 100 } },
              },
            ],
            from_time: new Date().toISOString(),
          };
        },
      };
    }

    const apiStore = useApiStore(pinia);
    apiStore.client = groupClient(10, "Alice");
    const container = mountFeed(pinia, { collapsible: false });
    await vi.advanceTimersByTimeAsync(0);
    const filter = container.querySelector('[aria-label="Select players to compare"]');
    filter.querySelector("button:last-child").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(filter.querySelector("button:last-child").getAttribute("aria-pressed")).toBe("false");

    apiStore.client = groupClient(20, "Bob");
    await vi.advanceTimersByTimeAsync(0);

    expect(filter.querySelector("button:last-child").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".activity-comparison-table thead th")).toHaveLength(2);
    expect(container.querySelector(".activity-comparison-table thead th:last-child").textContent).toContain("Bob");
    expect(container.querySelector(".activity-comparison-table tbody td").textContent.trim()).toBe("100");
  });

  it("grows a multi skill card while preserving expanded details and the reader's scroll position", async function growingCard() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
      return path;
    });
    useApiStore(pinia).client = {
      async fetchGameData() {
        return { quests: new Map(), items: new Map(), diaries: new Map() };
      },
      async fetchGroupData() {
        return [
          { id: 10, name: "Alice" },
          { id: 20, name: "Bob" },
        ];
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchActivity() {
        return { entries: [], from_time: new Date().toISOString() };
      },
    };
    const store = useActivityStore(pinia);
    const now = Date.now();
    const training = {
      id: 1,
      revision: 1,
      member_id: 10,
      type: "xp",
      started_at: now - 60_000,
      occurred_at: now,
      data: { skills: { Attack: 100, Hitpoints: 20 } },
    };
    store.mergeEntries([training]);
    store.loaded = true;
    const container = mountFeed(pinia);
    await vi.advanceTimersByTimeAsync(0);
    expect(container.textContent).toContain("120 XP");
    const details = container.querySelector("details");
    details.open = true;
    const scroll = container.querySelector(".activity-feed-scroll");
    scroll.scrollTop = 100;
    store.mergeEntries([
      { ...training, revision: 2, data: { skills: { Attack: 200, Hitpoints: 40 } } },
      {
        id: 2,
        revision: 1,
        member_id: 20,
        type: "quest",
        started_at: now + 1,
        occurred_at: now + 1,
        data: { quest_name: "Druidic Ritual", quest_id: 17 },
      },
    ]);
    await nextTick();
    await nextTick();
    expect(container.querySelectorAll(".activity-card")).toHaveLength(2);
    expect(container.textContent).toContain("240 XP");
    expect(container.querySelector('[data-entry-id="1"] details').open).toBe(true);
    expect(scroll.scrollTop).toBeGreaterThan(0);
  });

  it("loads and shows the next page near the bottom without duplicating pending requests", async function scrollHistory() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
      return path;
    });
    const now = Date.now();
    const entries = Array.from({ length: 50 }, function recordedActivity(_value, index) {
      return {
        id: index + 1,
        revision: 1,
        member_id: 10,
        type: "xp",
        started_at: now - index * 60_000,
        occurred_at: now - index * 60_000,
        data: { skills: { Attack: 100 } },
      };
    });
    const earlier = {
      ...entries[49],
      id: 51,
      is_weekly: true,
      started_at: activityWeek(now - 42 * 24 * 60 * 60_000),
      occurred_at: now - 42 * 24 * 60 * 60_000,
    };
    let resolveEarlier;
    const client = {
      credentials: { name: "Test group", token: "secret" },
      async fetchGameData() {
        return { quests: new Map(), items: new Map(), diaries: new Map() };
      },
      async fetchGroupData() {
        return [{ id: 10, name: "Alice", lastUpdated: new Date(now) }];
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      fetchActivity: vi
        .fn()
        .mockResolvedValueOnce({ entries, older_cursor: "earlier", from_time: new Date(now).toISOString() })
        .mockImplementationOnce(function pendingPage() {
          return new Promise(function captureResponse(resolve) {
            resolveEarlier = resolve;
          });
        }),
    };
    useApiStore(pinia).client = client;
    const container = mountFeed(pinia);
    await vi.advanceTimersByTimeAsync(0);
    expect(container.querySelectorAll(".activity-card")).toHaveLength(50);
    const scroll = container.querySelector(".activity-feed-scroll");
    Object.defineProperties(scroll, { clientHeight: { value: 200 }, scrollHeight: { value: 1000 } });
    scroll.scrollTop = 200;
    scroll.dispatchEvent(new Event("scroll"));
    expect(client.fetchActivity).toHaveBeenCalledTimes(1);

    scroll.scrollTop = 780;
    scroll.dispatchEvent(new Event("scroll"));
    scroll.dispatchEvent(new Event("scroll"));
    expect(client.fetchActivity).toHaveBeenCalledTimes(2);
    expect(client.fetchActivity).toHaveBeenLastCalledWith({ cursor: "earlier" });
    resolveEarlier({ entries: [earlier], older_cursor: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(container.querySelector('[data-entry-id="51"]')).not.toBeNull();
    expect(scroll.scrollTop).toBe(780);
    scroll.dispatchEvent(new Event("scroll"));
    expect(client.fetchActivity).toHaveBeenCalledTimes(2);
  });

  it("renames a comparison player and keeps cached summaries without fetching activity again", async function renameActivityMember() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
      return path;
    });
    const now = Date.now();
    const training = {
      id: 1,
      member_id: 10,
      revision: 1,
      type: "xp",
      started_at: now,
      occurred_at: now,
      data: { skills: { Attack: 100 } },
    };
    const client = {
      async fetchGameData() {
        return { quests: new Map(), items: new Map(), diaries: new Map() };
      },
      fetchGroupData: vi.fn().mockResolvedValue([{ id: 10, name: "Alice", colorHueDegrees: 100 }]),
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      fetchPlayerActivity: vi.fn().mockResolvedValue(playerHistory([training])),
      fetchActivity: vi
        .fn()
        .mockResolvedValue({ entries: [training], older_cursor: null, from_time: new Date(now).toISOString() }),
    };
    useApiStore(pinia).client = client;
    const container = mountFeed(pinia, { collapsible: false });
    await vi.advanceTimersByTimeAsync(0);
    const summary = container.querySelector(".activity-comparison-table tbody");

    client.fetchGroupData.mockResolvedValue([{ id: 10, name: "Renamed", colorHueDegrees: 100 }]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(container.querySelector(".activity-comparison-table tbody")).toBe(summary);
    expect(summary.querySelector("td").textContent.trim()).toBe("100");
    expect(container.querySelector(".activity-comparison-table thead th:last-child").textContent).toContain("Renamed");
    expect(client.fetchActivity).toHaveBeenCalledTimes(1);
    expect(client.fetchPlayerActivity).toHaveBeenCalledTimes(1);
  });
});

function mountFeed(pinia, props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: ActivityFeed },
      { path: "/group/activity", component: ActivityFeed },
    ],
  });
  const application = createTestApplication(ActivityFeed, props);
  application.use(pinia);
  application.use(router);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);

  return container;
}
