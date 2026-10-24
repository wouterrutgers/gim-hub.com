import { computed } from "vue";
import { defineStore } from "pinia";
import { useLocalStorage } from "../composables/local-storage";
import { siteThemes } from "./settings-options";

const DEFAULT_SITE_SETTINGS = Object.freeze({
  showActivitySidebar: true,
  filterActivityDrops: true,
  expandPlayerHistory: false,
  siteTheme: "light",
  enableVirtualLevels: true,
  enableSkillProgressBars: true,
  enableGearscapeExport: false,
});

const KEY_SITE_THEME = "settings-site-theme";
const KEY_ACTIVITY_SIDEBAR = "settings-activity-sidebar";
const KEY_ACTIVITY_DROP_FILTER = "settings-activity-drop-filter";
const KEY_PLAYER_HISTORY_EXPANSION = "settings-player-history-expansion";
const KEY_VIRTUAL_LEVELS = "settings-virtual-levels";
const KEY_SKILL_PROGRESS_BARS = "settings-skill-progress-bars";
const KEY_GEARSCAPE_EXPORT = "settings-gearscape-export";

function validateSiteTheme(value) {
  return siteThemes.find(function matchesTheme(theme) {
    return theme === value;
  });
}

function validateBoolean(value) {
  if (value === "true" || value === "false") {
    return value;
  }

  return undefined;
}

export const useSettingsStore = defineStore("settings", function createSettingsStore() {
  const [siteTheme, setSiteTheme] = useLocalStorage({
    key: KEY_SITE_THEME,
    defaultValue: DEFAULT_SITE_SETTINGS.siteTheme,
    validator: validateSiteTheme,
  });
  const [activitySidebar, setActivitySidebar] = useLocalStorage({
    key: KEY_ACTIVITY_SIDEBAR,
    defaultValue: String(DEFAULT_SITE_SETTINGS.showActivitySidebar),
    validator: validateBoolean,
  });
  const [activityDropFilter, setActivityDropFilter] = useLocalStorage({
    key: KEY_ACTIVITY_DROP_FILTER,
    defaultValue: String(DEFAULT_SITE_SETTINGS.filterActivityDrops),
    validator: validateBoolean,
  });
  const [playerHistoryExpansion, setPlayerHistoryExpansion] = useLocalStorage({
    key: KEY_PLAYER_HISTORY_EXPANSION,
    defaultValue: String(DEFAULT_SITE_SETTINGS.expandPlayerHistory),
    validator: validateBoolean,
  });
  const [virtualLevels, setVirtualLevels] = useLocalStorage({
    key: KEY_VIRTUAL_LEVELS,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableVirtualLevels),
    validator: validateBoolean,
  });
  const [skillProgressBars, setSkillProgressBars] = useLocalStorage({
    key: KEY_SKILL_PROGRESS_BARS,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableSkillProgressBars),
    validator: validateBoolean,
  });
  const [gearscapeExport, setGearscapeExport] = useLocalStorage({
    key: KEY_GEARSCAPE_EXPORT,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableGearscapeExport),
    validator: validateBoolean,
  });

  const showActivitySidebar = computed(function activitySidebarShown() {
    return activitySidebar.value === "true";
  });
  const filterActivityDrops = computed(function activityDropsFiltered() {
    return activityDropFilter.value === "true";
  });
  const expandPlayerHistory = computed(function playerHistoryExpanded() {
    return playerHistoryExpansion.value === "true";
  });
  const enableVirtualLevels = computed(function virtualLevelsEnabled() {
    return virtualLevels.value === "true";
  });
  const enableSkillProgressBars = computed(function skillProgressBarsEnabled() {
    return skillProgressBars.value === "true";
  });
  const enableGearscapeExport = computed(function gearscapeExportEnabled() {
    return gearscapeExport.value === "true";
  });

  function setShowActivitySidebar(value) {
    setActivitySidebar(String(value));
  }

  function setFilterActivityDrops(value) {
    setActivityDropFilter(String(value));
  }

  function setExpandPlayerHistory(value) {
    setPlayerHistoryExpansion(String(value));
  }

  function setEnableVirtualLevels(value) {
    setVirtualLevels(String(value));
  }

  function setEnableSkillProgressBars(value) {
    setSkillProgressBars(String(value));
  }

  function setEnableGearscapeExport(value) {
    setGearscapeExport(String(value));
  }

  return {
    siteTheme,
    setSiteTheme,
    showActivitySidebar,
    setShowActivitySidebar,
    filterActivityDrops,
    setFilterActivityDrops,
    expandPlayerHistory,
    setExpandPlayerHistory,
    enableVirtualLevels,
    setEnableVirtualLevels,
    enableSkillProgressBars,
    setEnableSkillProgressBars,
    enableGearscapeExport,
    setEnableGearscapeExport,
  };
});
