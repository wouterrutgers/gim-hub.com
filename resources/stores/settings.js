import { reactive, toRefs } from "vue";
import { defineStore } from "pinia";
import { readCachedPlayer } from "./cached-player-preferences";

export const DEFAULT_PLAYER_PREFERENCES = Object.freeze({
  collapseNavigation: false,
  showItemOwners: false,
  showActivitySidebar: false,
  filterActivityDrops: true,
  expandPlayerHistory: false,
  siteTheme: "light",
  pageBackgroundOpacity: 100,
  enableVirtualLevels: true,
  enableSkillProgressBars: true,
  enableGearscapeExport: false,
  pinnedItemIds: [],
  dismissedPluginWarningVersions: "[]",
});

export const useSettingsStore = defineStore("settings", function createSettingsStore() {
  const preferences = reactive({
    ...DEFAULT_PLAYER_PREFERENCES,
    ...(window.location.pathname === "/demo" ? undefined : readCachedPlayer()?.preferences),
  });

  function setPlayerPreferences(values = DEFAULT_PLAYER_PREFERENCES) {
    for (const [key, defaultValue] of Object.entries(DEFAULT_PLAYER_PREFERENCES)) {
      preferences[key] = values[key] ?? defaultValue;
    }
  }

  function setSiteTheme(value) {
    preferences.siteTheme = value;
  }

  function setCollapseNavigation(value) {
    preferences.collapseNavigation = value;
  }

  function setPageBackgroundOpacity(value) {
    previewPageBackgroundOpacity(value);
  }

  function previewPageBackgroundOpacity(value) {
    preferences.pageBackgroundOpacity = value;
  }

  function setShowItemOwners(value) {
    preferences.showItemOwners = value;
  }

  function setShowActivitySidebar(value) {
    preferences.showActivitySidebar = value;
  }

  function setFilterActivityDrops(value) {
    preferences.filterActivityDrops = value;
  }

  function setExpandPlayerHistory(value) {
    preferences.expandPlayerHistory = value;
  }

  function setEnableVirtualLevels(value) {
    preferences.enableVirtualLevels = value;
  }

  function setEnableSkillProgressBars(value) {
    preferences.enableSkillProgressBars = value;
  }

  function setEnableGearscapeExport(value) {
    preferences.enableGearscapeExport = value;
  }

  function setPinnedItemIds(value) {
    preferences.pinnedItemIds = value;
  }

  function setDismissedPluginWarningVersions(value) {
    preferences.dismissedPluginWarningVersions = value;
  }

  return {
    ...toRefs(preferences),
    setPlayerPreferences,
    setCollapseNavigation,
    setShowItemOwners,
    setSiteTheme,
    setPageBackgroundOpacity,
    previewPageBackgroundOpacity,
    setShowActivitySidebar,
    setFilterActivityDrops,
    setExpandPlayerHistory,
    setEnableVirtualLevels,
    setEnableSkillProgressBars,
    setEnableGearscapeExport,
    setPinnedItemIds,
    setDismissedPluginWarningVersions,
  };
});
