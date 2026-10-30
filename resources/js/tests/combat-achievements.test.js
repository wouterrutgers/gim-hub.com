// @vitest-environment jsdom

import { nextTick } from "vue";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { parseGroupData } from "../../api/requests/group-data";
import CombatAchievementsWindow from "../../components/combat-achievements/CombatAchievementsWindow.vue";

const tasks = [0, 31, 32, 416, 500, 654].map(function task(id, index) {
  return {
    id,
    name: `Task ${index + 1}`,
    description: `Complete challenge ${index + 1}.`,
    monster: index % 2 === 0 ? "Barrows" : "Zulrah",
    tier: index + 1,
  };
});

async function mountWindow(snapshot) {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async function imageChunks() {
      return {
        ok: true,
        json: async function emptyImages() {
          return {};
        },
      };
    }),
  );
  const pinia = createTestPinia();
  useApiStore(pinia).client = {
    async fetchGameData() {
      return { combatAchievements: tasks, quests: new Map() };
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchGroupData() {
      return parseGroupData([{ id: 1, name: "Alice", combat_achievements: snapshot }]);
    },
  };
  const container = document.createElement("div");
  document.body.append(container);
  createTestApplication(CombatAchievementsWindow, { player: "Alice" }).use(pinia).mount(container);
  await vi.advanceTimersByTimeAsync(0);

  return container;
}

describe("combat achievements", function combatAchievements() {
  it("summarizes uploaded task IDs and combines tier, search and completion filters", async function filterTasks() {
    const container = await mountWindow([0, 654]);
    expect(container.querySelector('[aria-label="Total tasks completed"]').value).toBe(2);
    expect(container.querySelector(".combat-achievements-points strong").textContent).toBe("7 / 21");

    container.querySelectorAll(".combat-achievements-tier")[5].click();
    await nextTick();
    expect(container.querySelectorAll(".combat-achievements-tasks li")).toHaveLength(1);
    expect(container.querySelector(".combat-achievements-task-name").textContent).toContain("Task 6");

    const search = container.querySelector("input");
    search.value = "No matching task";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(container.querySelector(".combat-achievements-empty")).not.toBeNull();
    container.querySelector(".combat-achievements-empty button").click();
    await nextTick();
    expect(container.querySelectorAll(".combat-achievements-tasks li")).toHaveLength(6);

    search.value = "Barrows";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const completion = container.querySelector("select");
    completion.value = "complete";
    completion.dispatchEvent(new Event("change"));
    await nextTick();
    expect(container.querySelectorAll(".combat-achievements-tasks li")).toHaveLength(1);
    expect(container.querySelector(".combat-achievements-task-name").textContent).toContain("Task 1");
  });
});
