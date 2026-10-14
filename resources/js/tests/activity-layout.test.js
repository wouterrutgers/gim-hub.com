// @vitest-environment jsdom
import { h, nextTick } from "vue";
import { setActivePinia } from "pinia";
import { createMemoryHistory, useRoute } from "vue-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { createApplicationRouter } from "../../router";
import { useApiStore } from "../../stores/api";
import { useImageStore } from "../../stores/images";
import AuthedLayout from "../../components/layout/AuthedLayout.vue";

describe("persistent activity layout", function activityLayout() {
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
    container.querySelector(".activity-restore").click();
    await nextTick();
    expect(timeline.style.display).not.toBe("none");
    expect(container.querySelector(".activity-restore")).toBeNull();
    expect(timeline.querySelector('[aria-label="Filter activity by type"]').value).toBe("xp");
    collapse.click();
    await nextTick();
    application.unmount();

    const nextVisit = await mountLayout();
    expect(nextVisit.container.querySelector(".activity-feed").style.display).toBe("none");
    expect(nextVisit.container.querySelector(".activity-restore")).not.toBeNull();
  });
});

async function mountLayout() {
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
      return [];
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchActivity() {
      return { entries: [], older_cursor: null, from_time: new Date().toISOString() };
    },
  };
  const router = createApplicationRouter(createMemoryHistory());
  await router.push("/group/items");
  const wrapper = {
    setup() {
      const route = useRoute();
      return function renderPage() {
        return h(
          AuthedLayout,
          { showPanels: route.meta.showPanels },
          {
            default: function pageContent() {
              return h("div", { "data-page": route.path }, route.path);
            },
          },
        );
      };
    },
  };
  const application = createTestApplication(wrapper);
  application.use(pinia);
  application.use(router);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  await vi.advanceTimersByTimeAsync(0);

  return { application, container, router };
}
