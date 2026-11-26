// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { nextTick } from "vue";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import WantedList from "../../components/items-page/WantedList.vue";
import itemData from "../../assets/data/item_data.json";
import recipes from "../../assets/data/wanted_recipes.json";
import { parseGroupData } from "../../api/requests/group-data";
import { useApiStore } from "../../stores/api";
import { useGroupStore } from "../../stores/group";

const items = new Map(
  [
    11889, 20714, 20716, 29801, 29804, 20366, 29799, 33534, 19553, 19541, 19501, 19493, 19496, 6571, 6573, 19529, 2357,
    1759, 564, 565, 566, 30843, 53, 52, 314, 10088, 20997, 577, 581, 1767, 4622, 13237, 13239, 31088, 31091, 31094,
    31111, 31115, 5358, 5364, 5370, 6585, 6581, 4699, 554, 557, 1393, 1395,
  ].map(function catalogueItem(itemId) {
    return [itemId, itemData[itemId]];
  }),
);

async function loadGameData() {
  return { items, quests: new Map() };
}

async function mount({ goals = [], readGroupData, fetchGameData = loadGameData }) {
  const pinia = createTestPinia();
  useApiStore(pinia).client = {
    fetchGameData,
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchGroupData() {
      return parseGroupData(readGroupData());
    },
    async fetchWantedItems() {
      return goals;
    },
    async saveWantedItem(goal) {
      return goal;
    },
  };
  useGroupStore(pinia);
  await vi.advanceTimersByTimeAsync(0);

  const container = document.createElement("div");
  document.body.append(container);
  const app = createTestApplication(WantedList, { active: true });
  app.use(pinia);
  app.mount(container);
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  return container;
}

async function expandMaterial(container, name) {
  const summary = [...container.querySelectorAll("summary")].find(function matchesMaterial(summary) {
    const material = summary.querySelector(".wanted-material-info");
    const label = material
      ? `${summary.querySelector(".wanted-material-quantity").textContent.trim()} ${material.firstElementChild.textContent}`
      : summary.textContent.trim();

    return label === name;
  });
  const details = summary.parentElement;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await nextTick();

  return details;
}

beforeEach(function stubAssets() {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async function fetchAssets(url) {
      return { ok: true, json: async () => (url.includes("wanted_recipes") ? recipes : {}) };
    }),
  );
});

afterEach(function restoreEnvironment() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("adds an unowned item from the catalogue and updates its goal when shared storage syncs", async function sharedGoal() {
  let groupData = [{ id: 1, name: "Alice", bank: [] }];
  const container = await mount({ readGroupData: () => groupData });

  container.querySelector(".wanted-heading button").click();
  await nextTick();
  const search = container.querySelector("#wanted-search");
  search.value = "tome of fire";
  search.dispatchEvent(new Event("input"));
  await nextTick();
  container.querySelector(".wanted-search-results button").click();
  await nextTick();
  container.querySelector("button[type=submit]").click();
  await nextTick();
  await nextTick();

  expect(container.querySelector(".wanted-goals").textContent).toContain("0 owned / 1 wanted");
  expect(container.querySelector(".wanted-shortfall").textContent).toContain("1 needed");

  groupData = [...groupData, { id: 2, name: "@SHARED", bank: [20716, 1] }];
  await vi.advanceTimersByTimeAsync(1000);

  expect(container.querySelector(".wanted-section").textContent).toContain("Completed");
  expect(container.querySelector(".wanted-goals").textContent).toContain("1 owned / 1 wanted");
});

it("expands Rancour intermediates and uses shared substitutes only once", async function rancourInputs() {
  const container = await mount({
    goals: [{ item_id: 29801, target_quantity: 5 }],
    readGroupData() {
      return [
        { id: 1, name: "Alice", bank: [29804, 2, 20366, 1, 19553, 1, 29799, 1, 19541, 1, 2357, 1, 1759, 1] },
        { id: 2, name: "@SHARED", bank: [33534, 1, 6571, 1, 564, 1, 565, 40, 566, 39, 30843, 1] },
      ];
    },
  });

  expect(container.querySelector(".wanted-goal").textContent).toContain("2 owned / 5 wanted");
  expect(container.querySelector(".wanted-shortfall").textContent).toContain("3 needed");
  const ingredients = await expandMaterial(container, "Materials still needed");
  const fang = await expandMaterial(ingredients, "2 × Etched araxyte fang");
  expect(fang.textContent).toContain("1 × Araxyte fang");

  const torture = await expandMaterial(ingredients, "2 × Amulet of torture");
  const runeRows = [...torture.querySelectorAll(".wanted-material-row")];
  expect(runeRows.find((row) => row.textContent.includes("Soul rune")).textContent).toContain("40 / 40 available");
  expect(runeRows.find((row) => row.textContent.includes("Cosmic rune")).textContent).toContain("2 / 2 available");

  const strungAmulet = await expandMaterial(torture, "1 × Zenyte amulet");
  const unstrungAmulet = await expandMaterial(strungAmulet, "1 × Zenyte amulet (u)");
  const zenyte = await expandMaterial(unstrungAmulet, "1 × Zenyte");
  const uncutZenyte = await expandMaterial(zenyte, "1 × Uncut zenyte");
  const onyx = await expandMaterial(uncutZenyte, "1 × Onyx");
  expect(uncutZenyte.textContent).toContain("1 × Zenyte shard");
  expect(onyx.textContent).toContain("Materials ready");
});

it("switches headless arrow methods in whole batches and keeps goals without recipes", async function headlessArrows() {
  let arrowQuantity = 10;
  const container = await mount({
    goals: [
      { item_id: 53, target_quantity: 37 },
      { item_id: 20997, target_quantity: 1 },
    ],
    readGroupData() {
      return [{ id: 1, name: "Alice", bank: [53, arrowQuantity, 52, 29, 314, 28, 10088, 12] }];
    },
  });

  const arrows = container.querySelector('[data-item-id="53"]');
  const materials = await expandMaterial(arrows, "Materials still needed");
  expect(materials.textContent).toContain("2 batches of 15");
  const inputs = materials.querySelector(".wanted-recipe > ul");
  expect(inputs.textContent).toContain("1 × Arrow shaft");
  expect(inputs.textContent).toContain("2 × Feather");

  const method = materials.querySelector("select");
  const redFeathers = [...method.options].find((option) => option.textContent.includes("Red feather"));
  method.value = redFeathers.value;
  method.dispatchEvent(new Event("change"));
  await nextTick();

  expect(inputs.textContent).toContain("18 × Red feather");
  expect(inputs.textContent).not.toContain("2 × Feather");
  arrowQuantity = 37;
  await vi.advanceTimersByTimeAsync(1000);
  expect(container.querySelector('[data-item-id="53"] details')).toBeNull();
  arrowQuantity = 10;
  await vi.advanceTimersByTimeAsync(1000);
  const reopened = container.querySelector('[data-item-id="53"] details');
  expect(reopened.open).toBe(true);
  expect(reopened.querySelector(".wanted-recipe > ul").textContent).toContain("18 × Red feather");

  const noRecipe = container.querySelector('[data-item-id="20997"]');
  expect(noRecipe.textContent).toContain("1 needed");
  expect(noRecipe.querySelector("details")).toBeNull();
});

it("stops expanding when a recipe would lead back to its target", async function robeCycle() {
  const container = await mount({
    goals: [{ item_id: 577, target_quantity: 2 }],
    readGroupData() {
      return [{ id: 1, name: "Alice", bank: [577, 1] }];
    },
  });

  const materials = await expandMaterial(container, "Materials still needed");
  expect(materials.textContent).toContain("1 × Black robe");
  expect(materials.textContent).toContain("Recipe requires an item already missing above.");
  expect([...materials.querySelectorAll("summary")].some((summary) => summary.textContent.includes("Black robe"))).toBe(
    false,
  );
});

it("shares demon tears made in one batch across both tread upgrades", async function treadUpgrades() {
  const container = await mount({
    goals: [{ item_id: 31094, target_quantity: 1 }],
    readGroupData() {
      return [{ id: 1, name: "Alice", bank: [31088, 1, 13237, 1, 13239, 1, 31115, 1] }];
    },
  });

  const materials = await expandMaterial(container, "Materials still needed");
  const upgrade = await expandMaterial(materials, "1 × Avernic treads (pr)");
  const tears = await expandMaterial(upgrade, "4,000 × Demon tear");

  expect(tears.textContent).toContain("1 batch of 10,000");
  expect(tears.textContent).toContain("Materials ready");
  expect(
    [...materials.querySelectorAll(".wanted-material-row")].filter((row) => row.textContent.includes("Eye of Ayak")),
  ).toHaveLength(1);
  expect(materials.textContent).toContain("4,000 from another batch");
});

it("plans the watering step for a sapling from an unwatered seedling", async function oakSapling() {
  const container = await mount({
    goals: [{ item_id: 5370, target_quantity: 1 }],
    readGroupData() {
      return [{ id: 1, name: "Alice", bank: [5358, 1] }];
    },
  });

  const materials = await expandMaterial(container, "Materials still needed");
  const watering = await expandMaterial(materials, "1 × Oak seedling (w)");

  expect(watering.textContent).toContain("Materials ready");
  expect(watering.querySelector(":scope > .wanted-recipe .wanted-material-name").textContent).toBe("Oak seedling");
  expect(watering.textContent).toContain("1 / 1 available");
});

it("uses lava runes for both enchantment elements and requires fire runes for a staff conversion", async function combinationRunes() {
  const container = await mount({
    goals: [
      { item_id: 6585, target_quantity: 1 },
      { item_id: 1393, target_quantity: 1 },
    ],
    readGroupData() {
      return [{ id: 1, name: "Alice", bank: [6581, 1, 564, 1, 4699, 20, 1395, 1] }];
    },
  });

  const fury = container.querySelector('[data-item-id="6585"]');
  const enchantment = await expandMaterial(fury, "Materials still needed");
  const method = enchantment.querySelector("select");
  method.value = [...method.options].find((option) => option.textContent.includes("Cosmic rune")).value;
  method.dispatchEvent(new Event("change"));
  await nextTick();

  expect(enchantment.querySelector("summary").textContent).toBe("Materials ready");

  const staff = container.querySelector('[data-item-id="1393"]');
  const conversion = await expandMaterial(staff, "Materials still needed");
  expect(conversion.textContent).toContain("100 × Fire rune");
});

it("keeps saved goals editable when the initial sync failed before Wanted opened", async function failedInitialSync() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async function fetchAssets(url) {
      return { ok: true, json: async () => (url.includes("item_data") ? { 11889: itemData[11889] } : {}) };
    }),
  );
  const container = await mount({
    goals: [{ item_id: 11889, target_quantity: 5 }],
    async fetchGameData() {
      throw new Error("Prices unavailable");
    },
  });

  expect(container.querySelector(".wanted-goal-item").textContent).toContain("Zamorakian hasta");
  expect(container.querySelector(".wanted-shortfall")).toBeNull();
  container.querySelector(".wanted-edit").click();
  await nextTick();

  expect(container.querySelector("#wanted-quantity").value).toBe("5");
});
