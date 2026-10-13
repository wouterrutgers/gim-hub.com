// @vitest-environment jsdom

import { h, nextTick } from "vue";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import PlayerSkills from "../../components/player-panel/PlayerSkills.vue";
import ItemPanel from "../../components/items-page/ItemPanel.vue";
import Tooltip from "../../components/tooltip/Tooltip.vue";
import { useApiStore } from "../../stores/api";

function tap(element) {
  for (const type of ["pointerover", "pointerdown", "pointerup", "pointerout"]) {
    element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: 160, clientY: 200 }));
  }

  const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
  element.dispatchEvent(click);

  return click;
}

describe("tooltips", function describeTooltips() {
  it("shows tooltips on touch while retaining link and button actions", async function touchTooltips() {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async function fetchImageChunk() {
        return Response.json({});
      }),
    );
    const pinia = createTestPinia();
    useApiStore(pinia).client = {
      async fetchGameData() {
        return { quests: new Map() };
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchGroupData() {
        return [{ name: "Test player", skills: { Attack: 150, Strength: 1000 }, lastUpdated: new Date() }];
      },
    };
    const container = document.createElement("div");
    document.body.append(container);
    const togglePin = vi.fn();
    const application = createTestApplication({
      render() {
        return [
          h(PlayerSkills, { member: "Test player" }),
          h(ItemPanel, {
            itemName: "Grimy guam leaf",
            itemID: 199,
            highAlchPer: 37,
            alchable: true,
            gePricePer: 100,
            imageURL: "/item-icons/199.webp",
            totalQuantity: 2,
            memberFilter: new Set(),
            containerFilter: "All",
            quantities: new Map(),
            isPinned: false,
            onTogglePin: togglePin,
          }),
          h(Tooltip),
        ];
      },
    });
    application.use(pinia);
    application.mount(container);
    await vi.advanceTimersByTimeAsync(0);

    const attack = container.querySelector('.skill-box[href$="/Attack"]');
    const strength = container.querySelector('.skill-box[href$="/Strength"]');
    const total = container.querySelector(".total-level-box");
    const tooltip = container.querySelector('[role="tooltip"]');

    const firstTap = tap(attack);
    await nextTick();
    expect(firstTap.defaultPrevented).toBe(true);
    expect(tooltip.textContent).toContain("150");

    const secondTap = tap(attack);
    await nextTick();
    expect(secondTap.defaultPrevented).toBe(false);
    expect(tooltip.textContent).toBe("");

    tap(attack);
    tap(strength);
    await nextTick();
    expect(tooltip.textContent).toContain("1,000");

    tap(total);
    await nextTick();
    expect(tooltip.textContent).toContain("1,150");

    tap(document.body);
    await nextTick();
    expect(tooltip.textContent).toBe("");

    tap(total);
    container.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(tooltip.textContent).toBe("");

    attack.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    attack.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerType: "touch" }));
    await nextTick();
    expect(tooltip.textContent).toBe("");

    tap(container.querySelector(".items-page-panel-item-details [data-tooltip]"));
    await nextTick();
    expect(tooltip.textContent).toContain("37");

    const pinTap = tap(container.querySelector(".items-page-panel-pin-button"));
    await nextTick();
    expect(pinTap.defaultPrevented).toBe(false);
    expect(togglePin).toHaveBeenCalledExactlyOnceWith(199);
    expect(tooltip.textContent).toBe("");
  });
});
