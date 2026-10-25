// @vitest-environment jsdom
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import ActivityFeed from "../../components/player-activity/ActivityFeed.vue";
import { useApiStore } from "../../stores/api";
import { useActivityStore } from "../../stores/activity";
import { useImageStore } from "../../stores/images";
import { activityWeek } from "../../game/activity";

describe("activity feed", function activityFeed() {
  it("clears the selected player when switching groups and shows the new group's activity", async function switchGroups() {
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
    const container = document.createElement("div");
    document.body.append(container);
    const application = createTestApplication(ActivityFeed);
    application.use(pinia);
    application.mount(container);
    await vi.advanceTimersByTimeAsync(0);
    const filter = container.querySelector('[aria-label="Filter activity by player"]');
    filter.value = "10";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    expect(filter.value).toBe("10");

    apiStore.client = groupClient(20, "Bob");
    await vi.advanceTimersByTimeAsync(0);

    expect(filter.value).toBe("");
    expect(container.querySelectorAll(".activity-card")).toHaveLength(1);
    expect(container.querySelector(".activity-card strong").textContent).toBe("Bob");
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
    const container = document.createElement("div");
    document.body.append(container);
    const application = createTestApplication(ActivityFeed);
    application.use(pinia);
    application.mount(container);
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
    const container = document.createElement("div");
    document.body.append(container);
    const application = createTestApplication(ActivityFeed);
    application.use(pinia);
    application.mount(container);
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

  it("renames cached cards and keeps the selected player without fetching activity again", async function renameActivityMember() {
    vi.useFakeTimers();
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
      return path;
    });
    const now = Date.now();
    const client = {
      async fetchGameData() {
        return { quests: new Map(), items: new Map(), diaries: new Map() };
      },
      fetchGroupData: vi.fn().mockResolvedValue([{ id: 10, name: "Alice", colorHueDegrees: 100 }]),
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      fetchActivity: vi.fn().mockResolvedValue({
        entries: [
          {
            id: 1,
            member_id: 10,
            revision: 1,
            type: "xp",
            started_at: now,
            occurred_at: now,
            data: { skills: { Attack: 100 } },
          },
        ],
        older_cursor: null,
        from_time: new Date(now).toISOString(),
      }),
    };
    useApiStore(pinia).client = client;
    const container = document.createElement("div");
    document.body.append(container);
    const application = createTestApplication(ActivityFeed);
    application.use(pinia);
    application.mount(container);
    await vi.advanceTimersByTimeAsync(0);
    const card = container.querySelector('[data-entry-id="1"]');
    const filter = container.querySelector('[aria-label="Filter activity by player"]');
    filter.value = "10";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    card.querySelector("details").open = true;

    client.fetchGroupData.mockResolvedValue([{ id: 10, name: "Renamed", colorHueDegrees: 100 }]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(container.querySelector('[data-entry-id="1"]')).toBe(card);
    expect(card.querySelector("strong").textContent).toBe("Renamed");
    expect(filter.value).toBe("10");
    expect(filter.selectedOptions[0].textContent).toBe("Renamed");
    expect(card.querySelector("details").open).toBe(true);
    expect(client.fetchActivity).toHaveBeenCalledTimes(1);
  });
});
