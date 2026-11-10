// @vitest-environment jsdom

import { setActivePinia } from "pinia";
import { describe, expect, it } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useSettingsStore } from "../../stores/settings";

describe("settings store", function describeSettingsStore() {
  it("uses the default settings before loading a player", function testDefaultSettings() {
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("light");
    expect(settingsStore.enableGearscapeExport).toBe(false);
  });

  it("resets player preferences when disconnecting", function testDisconnect() {
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();
    settingsStore.setPlayerPreferences({ siteTheme: "dark", pinnedItemIds: [995] });
    settingsStore.setPlayerPreferences();

    expect(settingsStore.siteTheme).toBe("light");
    expect(settingsStore.pinnedItemIds).toEqual([]);
  });

  it("ignores an invalid snapshot and a snapshot belonging to another player", function invalidCache() {
    localStorage.setItem("groupName", "test-group");
    localStorage.setItem("selected-players", JSON.stringify({ "test-group": 2 }));
    localStorage.setItem("player-preferences:test-group", "{");
    expect(useSettingsStore(createTestPinia()).siteTheme).toBe("light");

    localStorage.setItem(
      "player-preferences:test-group",
      JSON.stringify({ memberId: 1, preferences: { siteTheme: "dark" } }),
    );
    expect(useSettingsStore(createTestPinia()).siteTheme).toBe("light");
  });
});
