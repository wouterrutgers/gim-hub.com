import { computed } from "vue";
import { defineStore } from "pinia";
import { useLocalStorage } from "../composables/local-storage";
import { chatPanelPageOptions, sidebarPositions, siteThemes } from "./settings-options";

const DEFAULT_SITE_SETTINGS = Object.freeze({
  sidebarPosition: "left",
  siteTheme: "light",
  enableRecentActivity: true,
  enableVirtualLevels: true,
  enableSkillProgressBars: true,
  enableGearscapeExport: false,
  chatPanelPages: ["/group/items", "/group/map", "/group/history"],
});

const KEY_SITE_THEME = "settings-site-theme";
const KEY_SIDEBAR_POSITION = "settings-sidebar-position";
const KEY_RECENT_ACTIVITY = "settings-recent-activity";
const KEY_VIRTUAL_LEVELS = "settings-virtual-levels";
const KEY_SKILL_PROGRESS_BARS = "settings-skill-progress-bars";
const KEY_GEARSCAPE_EXPORT = "settings-gearscape-export";
const KEY_CHAT_PANEL_PAGES = "settings-chat-panel-pages";

function validateSiteTheme(value) {
  return siteThemes.find(function matchesTheme(theme) {
    return theme === value;
  });
}

function validateSidebarPosition(value) {
  return sidebarPositions.find(function matchesPosition(position) {
    return position === value;
  });
}

function validateBoolean(value) {
  if (value === "true" || value === "false") {
    return value;
  }

  return undefined;
}

const knownChatPanelPaths = new Set(chatPanelPageOptions.map(function getPath(option) {
  return option.path;
}));

function validateChatPanelPages(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const valid = parsed.filter(function isKnownPath(path) {
      return typeof path === "string" && knownChatPanelPaths.has(path);
    });

    return JSON.stringify(valid);
  } catch {
    return undefined;
  }
}

export const useSettingsStore = defineStore("settings", function createSettingsStore() {
  const [siteTheme, setSiteTheme] = useLocalStorage({
    key: KEY_SITE_THEME,
    defaultValue: DEFAULT_SITE_SETTINGS.siteTheme,
    validator: validateSiteTheme,
  });
  const [sidebarPosition, setSidebarPosition] = useLocalStorage({
    key: KEY_SIDEBAR_POSITION,
    defaultValue: DEFAULT_SITE_SETTINGS.sidebarPosition,
    validator: validateSidebarPosition,
  });
  const [recentActivity, setRecentActivity] = useLocalStorage({
    key: KEY_RECENT_ACTIVITY,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableRecentActivity),
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
  const [chatPanelPagesRaw, setChatPanelPagesRaw] = useLocalStorage({
    key: KEY_CHAT_PANEL_PAGES,
    defaultValue: JSON.stringify(DEFAULT_SITE_SETTINGS.chatPanelPages),
    validator: validateChatPanelPages,
  });

  const enableRecentActivity = computed(function recentActivityEnabled() {
    return recentActivity.value === "true";
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
  const chatPanelPages = computed(function getChatPanelPages() {
    try {
      return JSON.parse(chatPanelPagesRaw.value);
    } catch {
      return DEFAULT_SITE_SETTINGS.chatPanelPages;
    }
  });

  function setEnableRecentActivity(value) {
    setRecentActivity(String(value));
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

  function setChatPanelPages(paths) {
    setChatPanelPagesRaw(JSON.stringify(paths));
  }

  return {
    siteTheme,
    setSiteTheme,
    sidebarPosition,
    setSidebarPosition,
    enableRecentActivity,
    setEnableRecentActivity,
    enableVirtualLevels,
    setEnableVirtualLevels,
    enableSkillProgressBars,
    setEnableSkillProgressBars,
    enableGearscapeExport,
    setEnableGearscapeExport,
    chatPanelPages,
    setChatPanelPages,
  };
});
