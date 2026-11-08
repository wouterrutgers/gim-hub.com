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
});
