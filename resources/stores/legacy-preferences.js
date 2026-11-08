import { preferencesSchema } from "../api/requests/member-preferences";

const storageKeys = {
  collapseNavigation: "settings-navigation-collapsed",
  showItemOwners: "settings-item-owners",
  showActivitySidebar: "settings-activity-sidebar",
  filterActivityDrops: "settings-activity-drop-filter",
  expandPlayerHistory: "settings-player-history-expansion",
  siteTheme: "settings-site-theme",
  pageBackgroundOpacity: "settings-translucent-page-background",
  enableVirtualLevels: "settings-virtual-levels",
  enableSkillProgressBars: "settings-skill-progress-bars",
  enableGearscapeExport: "settings-gearscape-export",
  pinnedItemIds: "pinned-items",
  dismissedPluginWarningVersions: "dismissed-plugin-warning-versions",
};

function parsePreference(name, value) {
  if (name === "siteTheme") {
    return value;
  }

  if (name === "dismissedPluginWarningVersions") {
    return value || "[]";
  }

  if (name === "pinnedItemIds") {
    return value
      .split(",")
      .filter(function hasIdentifier(identifier) {
        return identifier.length > 0;
      })
      .map(Number);
  }

  if (name === "pageBackgroundOpacity" && (value === "true" || value === "false")) {
    return value === "true" ? 90 : 100;
  }

  return JSON.parse(value);
}

export function readLegacyPreferences() {
  const preferences = {};

  for (const [name, key] of Object.entries(storageKeys)) {
    const value = localStorage.getItem(key);

    if (value === null) {
      continue;
    }

    try {
      const result = preferencesSchema.shape[name].safeParse(parsePreference(name, value));

      if (result.success) {
        preferences[name] = result.data;
      }
    } catch {
      continue;
    }
  }

  return preferences;
}

export function clearLegacyPreferences() {
  for (const key of [...Object.values(storageKeys), "has-linked-player-preferences"]) {
    localStorage.removeItem(key);
  }
}
