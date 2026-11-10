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
  it("shows complete player summaries by day and keeps the choice between the sidebar and activity page", async function playerActivity() {
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
    const players = feed.querySelector(".activity-player-buttons");
    expect(
      [...players.querySelectorAll("button")].map(function name(button) {
        return button.textContent.trim();
      }),
    ).toEqual(["Everyone", "Alice", "Bob"]);
    const scroll = feed.querySelector(".activity-feed-scroll");
    scroll.scrollTop = 100;

    players.querySelectorAll("button")[1].click();
    await vi.advanceTimersByTimeAsync(0);

    expect(feed.querySelector(".activity-day .activity-date").textContent).toBe("Today");
    expect(feed.querySelector(".activity-summary-category").textContent).toContain("Attack: +300 XP");
    expect(scroll.scrollTop).toBe(0);
    const day = feed.querySelector(".activity-day");

    await router.push("/group/activity");
    await vi.waitFor(function activityPageIsReady() {
      expect(container.querySelector("#activity-page .activity-feed")).toBe(feed);
    });
    expect(players.querySelector('[aria-pressed="true"]').textContent.trim()).toBe("Alice");
    expect(feed.querySelector(".activity-day")).toBe(day);

    const filter = feed.querySelector('[aria-label="Filter activity by type"]');
    filter.value = "quest";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    expect(feed.querySelector(".activity-day")).toBeNull();
    expect(feed.querySelector(".activity-empty")).not.toBeNull();
    filter.value = "";
    filter.dispatchEvent(new Event("change"));
    await nextTick();
    players.querySelectorAll("button")[2].click();
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.querySelector(".activity-day")).toBeNull();

    players.querySelector("button").click();
    await nextTick();
    expect(feed.querySelector(".activity-day")).toBeNull();
    expect(players.querySelector('[aria-pressed="true"]').textContent.trim()).toBe("Everyone");
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
