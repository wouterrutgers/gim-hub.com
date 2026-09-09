// @vitest-environment jsdom

import { createPinia } from "pinia";
import { createApp, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import PlayerInventory from "../../components/player-panel/PlayerInventory.vue";
import ItemsPage from "../../components/items-page/ItemsPage.vue";
import Tooltip from "../../components/tooltip/Tooltip.vue";
import { useApiStore } from "../../stores/api";
import { parseGroupData } from "../../api/requests/group-data";

const portableItems = [13226, 22586, 24482, 24481, 30000];
const items = new Map([
  ...portableItems.map(function portableItem(id) {
    return [id, { name: `Container ${id}`, highalch: 0 }];
  }),
  [1095, { name: "Leather chaps", highalch: 12, alchable: true }],
  [199, { name: "Grimy guam leaf", highalch: 3 }],
]);

describe("storage UI", function storageInterface() {
  let app;
  let container;
  let payload;

  afterEach(function cleanup() {
    app?.unmount();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(component) {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async function imageChunks() {
        return {
          ok: true,
          async json() {
            return {};
          },
        };
      }),
    );
    const pinia = createPinia();
    useApiStore(pinia).client = {
      async fetchGameData() {
        return { items, quests: new Map(), gePrices: new Map() };
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchGroupData() {
        return parseGroupData(payload);
      },
    };
    container = document.createElement("div");
    document.body.append(container);
    app = createApp(component);
    app.use(pinia);
    app.component("RouterLink", {
      render() {
        return h("a", this.$slots.default());
      },
    });
    app.mount(container);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
  }

  it("shows unknown, observed and empty portable contents through inventory tooltips", async function portableTooltips() {
    payload = [
      {
        name: "Alice",
        inventory: Array.from({ length: 28 }, function slot(_value, index) {
          return [portableItems[index] ?? 0, portableItems[index] ? 1 : 0];
        }).flat(),
      },
    ];
    await mount({
      render() {
        return [h(PlayerInventory, { member: "Alice" }), h(Tooltip)];
      },
    });
    const links = container.querySelectorAll(".player-inventory-item-box");
    expect(links.length).toBe(5);
    for (const link of links) {
      link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      await nextTick();
      expect(container.querySelector('[role="tooltip"]').textContent).toContain("Contents unknown");
    }

    payload = [{ ...payload[0], herb_sack: [199, 2], looting_bag: [], seed_box: [], gem_bag: [], chugging_barrel: [] }];
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    links[0].dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[role="tooltip"]').textContent).toContain("2 Grimy guam leaf");
    for (const link of [...links].slice(1)) {
      link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      await nextTick();
      expect(container.querySelector('[role="tooltip"]').textContent).toContain("Empty");
      expect(container.querySelector('[role="tooltip"]').textContent).not.toContain("unknown");
    }
  });

  it("uses the usual empty inventory view when STASH units have no known items", async function statusOnlyUnits() {
    payload = [
      {
        name: "Alice",
        stash_units: [
          { id: 29019, name: "Kharazi Jungle", tier: "Hard", state: "filled", items: [], alternatives: ["Any stole"] },
          { id: 34736, name: "Varrock", tier: "Beginner", state: "unbuilt", items: [], alternatives: [] },
        ],
      },
    ];
    await mount(ItemsPage);
    expect(container.querySelector(".stash-units")).toBeNull();
    expect(container.querySelector("#items-page-no-items")).not.toBeNull();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(0);
  });

  it("shows STASH contents in normal item panels with search, filters and reconciled quantities", async function stashItems() {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
    payload = [
      {
        name: "Alice",
        bank: [199, 3],
        stash_units: [
          { id: 28958, name: "Lumbridge Swamp", tier: "Easy", state: "filled", items: [1095, 1], alternatives: [] },
          { id: 28959, name: "Wizards' Tower", tier: "Easy", state: "filled", items: [1095, 1], alternatives: [] },
          { id: 29019, name: "Kharazi Jungle", tier: "Hard", state: "filled", items: [], alternatives: ["Any stole"] },
          { id: 34736, name: "Varrock", tier: "Beginner", state: "unbuilt", items: [], alternatives: [] },
        ],
      },
    ];
    await mount({
      render() {
        return [h(ItemsPage), h(Tooltip)];
      },
    });
    expect(container.querySelector(".stash-units")).toBeNull();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(2);

    const storageFilter = container.querySelectorAll("select")[1];
    storageFilter.value = "STASH units";
    storageFilter.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(1);
    expect(container.querySelector(".items-page-panel-name").textContent).toBe("Leather chaps");
    expect(container.querySelector(".items-page-panel-item-details").children[1].textContent).toBe("2");
    expect(container.querySelector(".items-page-panel-item-details").children[3].textContent).toBe("24gp");

    container
      .querySelector(".items-page-panel-quantity-breakdown span")
      .dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[role="tooltip"]').textContent).toContain("Lumbridge Swamp");
    expect(container.querySelector('[role="tooltip"]').textContent).toContain("Wizards' Tower");

    const search = container.querySelector("#items-page-search input");
    search.value = "guam";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(0);
    search.value = "leather";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(1);

    payload[0].stash_units[0] = { ...payload[0].stash_units[0], state: "empty", items: [] };
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(container.querySelector(".items-page-panel-item-details").children[1].textContent).toBe("1");

    container.querySelector("#items-page-member-filter-Alice").click();
    await nextTick();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(0);
    container.querySelector("#items-page-reset-filters-button").click();
    await nextTick();
    expect(container.querySelectorAll(".items-page-panel").length).toBe(2);
  });
});
