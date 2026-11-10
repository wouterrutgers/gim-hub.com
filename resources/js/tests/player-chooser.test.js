// @vitest-environment jsdom

import { h, nextTick, ref } from "vue";
import { setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { useGroupStore } from "../../stores/group";
import { useImageStore } from "../../stores/images";
import { usePlayerPreferencesStore } from "../../stores/player-preferences";
import PlayerPreferences from "../../components/player-preferences/PlayerPreferences.vue";
import Modal from "../../components/modal/Modal.vue";

describe("player chooser", function describePlayerChooser() {
  it("requires a player choice after waiting for an existing dialog", async function requireSelection() {
    const otherOpen = ref(true);
    const playerPreferencesStore = await mountChooser({ otherOpen, firstVisit: true });
    expect(document.querySelector("#player-chooser-window")).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    playerPreferencesStore.pending = true;
    otherOpen.value = false;

    await vi.waitFor(function chooserShown() {
      expect(document.querySelector("#player-chooser-window")).not.toBeNull();
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector("#player-chooser-window .dialog-close")).toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.querySelector("#modal-clickbox").click();
    await nextTick();
    expect(playerPreferencesStore.chooserOpen).toBe(true);
    expect(document.querySelector("#player-chooser-window")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector('#player-chooser-window [role="status"]'));
  });

  it("keeps the current player when a different radio option is selected and cancelled", async function cancelSelection() {
    const playerPreferencesStore = await mountChooser();
    const choosePlayer = vi.spyOn(playerPreferencesStore, "choosePlayer").mockResolvedValue(true);

    document.querySelector('#player-chooser-window input[value="2"]').click();
    await nextTick();
    expect(playerPreferencesStore.selectedMemberId).toBe(1);
    expect(choosePlayer).not.toHaveBeenCalled();

    document.querySelector('#player-chooser-window form .men-button[type="button"]').click();
    await nextTick();

    expect(document.querySelector("#player-chooser-window")).toBeNull();
    expect(playerPreferencesStore.selectedMemberId).toBe(1);
    expect(choosePlayer).not.toHaveBeenCalled();
  });

  it("keeps a failed choice open and closes only after explicitly confirming a successful choice", async function confirmSelection() {
    const playerPreferencesStore = await mountChooser();
    const choosePlayer = vi
      .spyOn(playerPreferencesStore, "choosePlayer")
      .mockImplementationOnce(async function failSelection() {
        playerPreferencesStore.error = "Could not load preferences.";

        return false;
      })
      .mockImplementationOnce(async function selectPlayer(memberId) {
        playerPreferencesStore.selectedMemberId = memberId;

        return true;
      });

    document.querySelector('#player-chooser-window input[value="2"]').click();
    await nextTick();
    document.querySelector('#player-chooser-window button[type="submit"]').click();

    await vi.waitFor(function failedChoiceRemainsOpen() {
      expect(document.querySelector('#player-chooser-window [role="alert"]')).not.toBeNull();
    });
    expect(playerPreferencesStore.selectedMemberId).toBe(1);

    document.querySelector('#player-chooser-window button[type="submit"]').click();

    await vi.waitFor(function successfulChoiceCloses() {
      expect(document.querySelector("#player-chooser-window")).toBeNull();
    });
    expect(choosePlayer).toHaveBeenNthCalledWith(1, 2);
    expect(choosePlayer).toHaveBeenNthCalledWith(2, 2);
    expect(playerPreferencesStore.selectedMemberId).toBe(2);
  });
});

async function mountChooser({ otherOpen = ref(false), firstVisit = false } = {}) {
  const pinia = createTestPinia();
  setActivePinia(pinia);
  const groupStore = useGroupStore(pinia);
  groupStore.memberStates.set("Alice", { id: 1 });
  groupStore.memberStates.set("Bob", { id: 2 });
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("/ui/player-icon.webp");
  const playerPreferencesStore = usePlayerPreferencesStore(pinia);

  if (!firstVisit) {
    playerPreferencesStore.selectedMemberId = 1;
  }

  playerPreferencesStore.openChooser();
  const otherWindow = {
    render() {
      return h("section", { role: "dialog" }, [h("button", "Close")]);
    },
  };
  const application = createTestApplication({
    render() {
      return [h(Modal, { open: otherOpen.value, component: otherWindow }), h(PlayerPreferences)];
    },
  });
  application.use(pinia);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  await nextTick();
  await nextTick();

  return playerPreferencesStore;
}
