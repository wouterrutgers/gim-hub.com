import { computed } from "vue";
import { defineStore } from "pinia";
import { useLocalStorage } from "../composables/local-storage";
import { siteThemes } from "./settings-options";

const DEFAULT_SITE_SETTINGS = Object.freeze({
  collapseNavigation: false,
  showItemOwners: false,
  showActivitySidebar: false,
  filterActivityDrops: true,
  expandPlayerHistory: false,
  siteTheme: "light",
  pageBackgroundOpacity: 90,
  enableVirtualLevels: true,
  enableSkillProgressBars: true,
  enableGearscapeExport: false,
});

const KEY_SITE_THEME = "settings-site-theme";
const KEY_PAGE_BACKGROUND_OPACITY = "settings-translucent-page-background";
const KEY_NAVIGATION_COLLAPSED = "settings-navigation-collapsed";
const KEY_ITEM_OWNERS = "settings-item-owners";
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

function validatePageBackgroundOpacity(value) {
  if (value === "true" || value === "false") {
    return value === "true" ? "90" : "100";
  }

  const opacity = Number(value);

  if (Number.isInteger(opacity) && opacity >= 0 && opacity <= 100) {
    return value;
  }

  return undefined;
}

export const useSettingsStore = defineStore("settings", function createSettingsStore() {
  const [navigationCollapsed, setNavigationCollapsed] = useLocalStorage({
    key: KEY_NAVIGATION_COLLAPSED,
    defaultValue: String(DEFAULT_SITE_SETTINGS.collapseNavigation),
    validator: validateBoolean,
  });
  const [itemOwners, setItemOwners] = useLocalStorage({
    key: KEY_ITEM_OWNERS,
    defaultValue: String(DEFAULT_SITE_SETTINGS.showItemOwners),
    validator: validateBoolean,
  });
  const [siteTheme, setSiteTheme] = useLocalStorage({
    key: KEY_SITE_THEME,
    defaultValue: DEFAULT_SITE_SETTINGS.siteTheme,
    validator: validateSiteTheme,
  });
  const [backgroundOpacity, setBackgroundOpacity] = useLocalStorage({
    key: KEY_PAGE_BACKGROUND_OPACITY,
    defaultValue: String(DEFAULT_SITE_SETTINGS.pageBackgroundOpacity),
    validator: validatePageBackgroundOpacity,
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

  const collapseNavigation = computed(function navigationIsCollapsed() {
    return navigationCollapsed.value === "true";
  });
  const pageBackgroundOpacity = computed(function getPageBackgroundOpacity() {
    return Number(backgroundOpacity.value);
  });
  const showItemOwners = computed(function itemOwnersAreShown() {
    return itemOwners.value === "true";
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

  function setCollapseNavigation(value) {
    setNavigationCollapsed(String(value));
  }

  function setPageBackgroundOpacity(value) {
    setBackgroundOpacity(String(value));
  }

  function setShowItemOwners(value) {
    setItemOwners(String(value));
  }

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
    collapseNavigation,
    setCollapseNavigation,
    showItemOwners,
    setShowItemOwners,
    siteTheme,
    setSiteTheme,
    pageBackgroundOpacity,
    setPageBackgroundOpacity,
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
