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
    expect(settingsStore.enableGearscapeExport).toBe(false);
  });

  it("loads valid persisted settings", function testPersistedSettings() {
    localStorage.setItem("settings-site-theme", "dark");
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("dark");
  });

  it("ignores invalid persisted settings", function testInvalidSettings() {
    localStorage.setItem("settings-site-theme", "system");
    setActivePinia(createTestPinia());
    const settingsStore = useSettingsStore();

    expect(settingsStore.siteTheme).toBe("light");
  });
});
