// @vitest-environment jsdom

import { setActivePinia } from "pinia";
import { describe, expect, it } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useSettingsStore } from "../../stores/settings";

describe("settings store", function describeSettingsStore() {
  it("uses the default settings when storage is empty", function testDefaultSettings() {
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("light");
    expect(settingsStore.sidebarPosition).toBe("left");
    expect(settingsStore.enableRecentActivity).toBe(true);
    expect(settingsStore.enableGearscapeExport).toBe(false);
  });

  it("loads valid persisted settings", function testPersistedSettings() {
    localStorage.setItem("settings-site-theme", "dark");
    localStorage.setItem("settings-sidebar-position", "right");
    localStorage.setItem("settings-recent-activity", "false");
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("dark");
    expect(settingsStore.sidebarPosition).toBe("right");
    expect(settingsStore.enableRecentActivity).toBe(false);
  });

  it("ignores invalid persisted settings", function testInvalidSettings() {
    localStorage.setItem("settings-site-theme", "system");
    localStorage.setItem("settings-recent-activity", "yes");
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("light");
    expect(settingsStore.enableRecentActivity).toBe(true);
  });
});
