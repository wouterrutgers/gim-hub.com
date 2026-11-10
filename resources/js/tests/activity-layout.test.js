// @vitest-environment jsdom
import { nextTick } from "vue";
import { setActivePinia } from "pinia";
import { createMemoryHistory } from "vue-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { createApplicationRouter } from "../../router";
import { useApiStore } from "../../stores/api";
import { useImageStore } from "../../stores/images";
import App from "../../components/app/App.vue";

vi.mock("../../components/canvas-map/CanvasMap.vue", function mapCanvas() {
  return {
    __esModule: true,
    default: {
      render() {
        return null;
      },
    },
  };
});
vi.mock("../../api/requests/changelog", function changelog() {
  return { fetchChangelog: vi.fn().mockResolvedValue([]) };
});

describe("persistent activity layout", function activityLayout() {
  it("loads complete comparison days automatically and keeps earlier history paged", async function compareActivity() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    const today = new Date().setHours(0, 0, 0, 0);

    function day(start, memberIdentifier, skills) {
      return {
        key: `day:${start}`,
        kind: "day",
        started_at: start,
        ended_at: start + 86_400_000,
        entries: [
          {
            id: start + memberIdentifier,
            member_id: memberIdentifier,
            type: "xp",
            revision: 1,
            started_at: start + 60_000,
            occurred_at: start + 60_000,
            data: { skills },
          },
        ],
      };
    }

    const { container, router } = await mountLayout([
      { id: 10, name: "Alice" },
      { id: 20, name: "Bob" },
    ]);
    const client = useApiStore().client;
    let finishOlder;
    const fetch = vi.spyOn(client, "fetchPlayerActivity").mockImplementation(async function history({
      memberIdentifier,
      cursor,
      fromTime,
    }) {
      if (memberIdentifier === 10 && cursor === `day:${today - 6 * 86_400_000}`) {
        return new Promise(function pendingHistory(resolve) {
          finishOlder = resolve;
        });
      }

      if (cursor) {
        return {
          periods: [day(today - 14 * 86_400_000, memberIdentifier, { Attack: memberIdentifier === 10 ? 500 : 750 })],
          older_cursor: null,
          from_time: new Date().toISOString(),
        };
      }

      if (memberIdentifier === 10) {
        return {
          periods: Array.from({ length: 7 }, function recordedDay(_value, index) {
            return day(
              today - index * 86_400_000,
              10,
              index === 0 ? { Attack: fromTime ? 300 : 100, Strength: 25 } : { Attack: 50 },
            );
          }),
          older_cursor: `day:${today - 6 * 86_400_000}`,
          from_time: new Date().toISOString(),
        };
      }

      return {
        periods: Array.from({ length: 7 }, function recordedDay(_value, index) {
          return day(today - index * 2 * 86_400_000, 20, { Attack: index === 0 ? 200 : 250 });
        }),
        older_cursor: `day:${today - 12 * 86_400_000}`,
        from_time: new Date().toISOString(),
      };
    });
    await router.push("/group/activity");
    await vi.waitFor(function pageIsReady() {
      expect(container.querySelector(".activity-comparison-table")).not.toBeNull();
    });
    await vi.advanceTimersByTimeAsync(0);
    const comparison = container.querySelector(".activity-comparison-scroll");

    function values(start, label) {
      const row = [...comparison.querySelector(`[data-period-key="day:${start}"]`).querySelectorAll("tr")].find(
        function activity(row) {
          return row.querySelector('th[scope="row"]')?.textContent.trim() === label;
        },
      );

      return [...row.querySelectorAll("td")].map(function value(cell) {
        return cell.textContent.trim();
      });
    }

    expect(
      [...comparison.querySelectorAll("thead th")].map(function name(header) {
        return header.textContent.trim();
      }),
    ).toEqual(["Activity", "Alice", "Bob"]);
    expect(values(today, "Attack XP")).toEqual(["100", "200"]);
    expect(values(today, "Total XP")).toEqual(["125", "200"]);
    expect(values(today, "Strength XP")).toEqual(["25", "None"]);
    expect(values(today - 8 * 86_400_000, "Attack XP")).toEqual(["Loading…", "250"]);
    finishOlder({
      periods: Array.from({ length: 7 }, function recordedDay(_value, index) {
        return day(today - (index + 7) * 86_400_000, 10, { Attack: 150 });
      }),
      older_cursor: `day:${today - 13 * 86_400_000}`,
      from_time: new Date().toISOString(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(values(today - 8 * 86_400_000, "Attack XP")).toEqual(["150", "250"]);
    expect(comparison.querySelectorAll("tbody")).toHaveLength(13);
    expect(
      fetch.mock.calls
        .filter(function earlier([options]) {
          return options.cursor;
        })
        .map(function cursor([options]) {
          return options.cursor;
        }),
    ).toEqual([`day:${today - 6 * 86_400_000}`]);

    comparison.querySelector(".activity-older").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(values(today - 14 * 86_400_000, "Attack XP")).toEqual(["500", "750"]);

    const filter = container.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "boss";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comparison.querySelectorAll("tbody")).toHaveLength(0);
    filter.value = "";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    container.querySelector(".activity-player-buttons button:last-child").click();
    await nextTick();
    const calls = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(values(today, "Attack XP")).toEqual(["300"]);
    expect(
      fetch.mock.calls.slice(calls).map(function player([options]) {
        return options.memberIdentifier;
      }),
    ).toEqual([10]);

    await router.push("/group/items");
    await vi.waitFor(function sidebarIsReady() {
      expect(container.querySelector(".activity-dock .activity-page-link")).not.toBeNull();
    });
    expect(container.querySelector(".activity-comparison-scroll")).toBeNull();
    expect(container.querySelector(".activity-player-buttons")).toBeNull();
    await router.push("/group/activity");
    await vi.waitFor(function comparisonIsReady() {
      expect(container.querySelectorAll(".activity-comparison-table thead th")).toHaveLength(2);
    });
  });

  it("opens daily comparisons from the sidebar and remembers the players while keeping the sidebar a group timeline", async function compareFromSidebar() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    const startedAt = new Date().setHours(0, 0, 0, 0);
    const entries = [100, 200].map(function training(quantity, index) {
      return {
        id: index + 1,
        revision: 1,
        member_id: 10,
        type: "xp",
        started_at: Date.now() - index * 60_000,
        occurred_at: Date.now(),
        data: { skills: { Attack: quantity } },
      };
    });
    const history = new Map([
      [
        10,
        [{ key: `day:${startedAt}`, kind: "day", started_at: startedAt, ended_at: startedAt + 86_400_000, entries }],
      ],
    ]);
    const { container, router } = await mountLayout(
      [
        { id: 10, name: "Alice" },
        { id: 20, name: "Bob" },
      ],
      history,
    );
    const feed = container.querySelector(".activity-feed");
    const link = feed.querySelector(".activity-page-link");
    expect(link.getAttribute("href")).toBe("/group/activity");
    expect(feed.querySelector(".activity-player-buttons")).toBeNull();

    link.click();
    await vi.waitFor(function activityPageIsReady() {
      expect(container.querySelector("#activity-page .activity-feed")).toBe(feed);
      expect(feed.querySelector(".activity-comparison-table tbody")).not.toBeNull();
    });
    const players = feed.querySelector(".activity-player-buttons");
    const comparison = feed.querySelector(".activity-comparison-scroll");
    expect(comparison.querySelector(".activity-comparison-period").textContent).toContain("Today");
    expect(comparison.querySelector("tbody td").textContent.trim()).toBe("300");
    expect(comparison.querySelectorAll("thead th")).toHaveLength(3);
    players.querySelectorAll("button")[2].click();
    await nextTick();
    expect(comparison.querySelectorAll("thead th")).toHaveLength(2);

    comparison.scrollTop = 100;
    const filter = feed.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "quest";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comparison.querySelector("tbody")).toBeNull();
    expect(feed.querySelector(".activity-empty")).not.toBeNull();
    expect(comparison.scrollTop).toBe(0);
    filter.value = "";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comparison.querySelector("tbody td").textContent.trim()).toBe("300");

    await router.push("/group/items");
    await vi.waitFor(function sidebarIsReady() {
      expect(feed.querySelector(".activity-page-link")).not.toBeNull();
    });
    expect(feed.querySelector(".activity-player-buttons")).toBeNull();
    expect(feed.querySelector(".activity-timeline")).not.toBeNull();
    feed.querySelector(".activity-page-link").click();
    await vi.waitFor(function comparisonIsReady() {
      expect(feed.querySelectorAll(".activity-comparison-table thead th")).toHaveLength(2);
    });
  });

  it("keeps the timeline and its filters while changing pages and player panel visibility", async function persistentTimeline() {
    vi.useFakeTimers();
    const { container, router } = await mountLayout();
    const timeline = container.querySelector(".activity-feed");
    expect(timeline).not.toBeNull();
    const filter = timeline.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "xp";
    filter.dispatchEvent(new Event("change"));
    await nextTick();

    for (const path of ["/group/map", "/group/panels"]) {
      await router.push(path);
      await nextTick();
      expect(container.querySelector(".activity-feed")).toBe(timeline);
      expect(timeline.querySelector('[aria-label="Filter activity by type"]').value).toBe("xp");
    }
  });

  it("hides and restores activity without resetting filters and remembers the choice on the next visit", async function toggleActivity() {
    vi.useFakeTimers();
    const { application, container } = await mountLayout();
    const timeline = container.querySelector(".activity-feed");
    const filter = timeline.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "xp";
    filter.dispatchEvent(new Event("change"));
    const collapse = container.querySelector(".activity-collapse");

    collapse.click();
    await nextTick();
    expect(timeline.style.display).toBe("none");
    container.querySelector(".activity-toggle").click();
    await nextTick();
    expect(timeline.style.display).not.toBe("none");
    expect(container.querySelector(".activity-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(collapse);
    expect(timeline.querySelector('[aria-label="Filter activity by type"]').value).toBe("xp");
    collapse.click();
    await nextTick();
    await vi.waitFor(function activityTabHasFocus() {
      expect(document.activeElement).toBe(container.querySelector(".activity-toggle"));
    });
    application.unmount();

    const nextVisit = await mountLayout();
    expect(nextVisit.container.querySelector(".activity-feed").style.display).toBe("none");
    expect(nextVisit.container.querySelector(".activity-toggle").getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps independent player panels and activity filters through Members and What's new", async function workspaceState() {
    vi.useFakeTimers();
    const { container, router } = await mountLayout([
      { id: 1, name: "Workspace Alice" },
      { id: 2, name: "Workspace Bob" },
    ]);

    for (const panel of container.querySelectorAll(".player-panel")) {
      panel.querySelector('[aria-label="inventory"]').click();
    }

    const timeline = container.querySelector(".activity-feed");
    const filter = timeline.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "xp";
    filter.dispatchEvent(new Event("change"));
    await nextTick();

    for (const path of ["/group/panels", "/changelog", "/group/items"]) {
      await router.push(path);
      await nextTick();
      expect(container.querySelectorAll('.player-panel [aria-label="inventory"][aria-pressed="true"]')).toHaveLength(2);
      expect(container.querySelector(".activity-feed")).toBe(timeline);
      expect(filter.value).toBe("xp");
    }
  });
});

async function mountLayout(members = [], history = new Map()) {
  const pinia = createTestPinia();
  setActivePinia(pinia);
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockImplementation(function imagePath(path) {
    return path;
  });
  useApiStore(pinia).client = {
    credentials: { name: "Test group", token: "secret" },
    async fetchGameData() {
      return { quests: new Map(), items: new Map(), diaries: new Map() };
    },
    async fetchGroupData() {
      return members;
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchPlayerActivity({ memberIdentifier }) {
      return { periods: history.get(memberIdentifier) ?? [], older_cursor: null, from_time: new Date().toISOString() };
    },
    async fetchActivity() {
      return { entries: [], older_cursor: null, from_time: new Date().toISOString() };
    },
  };
  const router = createApplicationRouter(createMemoryHistory());
  await router.push("/group/items");
  const application = createTestApplication(App);
  application.use(pinia);
  application.use(router);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  await vi.advanceTimersByTimeAsync(0);

  return { application, container, router };
}
