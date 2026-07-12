import { createContext, type ReactElement, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/local-storage";
import { SidebarPosition, SiteTheme } from "./settings-types";

interface Settings {
  siteTheme: SiteTheme;
  setSiteTheme?: (value: SiteTheme) => void;
  sidebarPosition: SidebarPosition;
  setSidebarPosition?: (value: SidebarPosition) => void;
  enableRecentActivity: boolean;
  setEnableRecentActivity?: (value: boolean) => void;
  enableVirtualLevels: boolean;
  setEnableVirtualLevels?: (value: boolean) => void;
  enableSkillProgressBars: boolean;
  setEnableSkillProgressBars?: (value: boolean) => void;
}

const DEFAULT_SITE_SETTINGS = Object.freeze({
  sidebarPosition: "left",
  siteTheme: "light",
  enableRecentActivity: true,
  enableVirtualLevels: true,
  enableSkillProgressBars: true,
} satisfies Settings);

/* oxlint-disable react/only-export-components */

/**
 * Provides user settings for the website, such as the position of the sidebar
 * and dark or light theme.
 */
export const SettingsContext = createContext<Settings>(DEFAULT_SITE_SETTINGS);

/* oxlint-enable react/only-export-components */

const KEY_SITE_THEME = "settings-site-theme";
const KEY_SIDEBAR_POSITION = "settings-sidebar-position";
const KEY_RECENT_ACTIVITY = "settings-recent-activity";
const KEY_VIRTUAL_LEVELS = "settings-virtual-levels";
const KEY_SKILL_PROGRESS_BARS = "settings-skill-progress-bars";

const validateSiteTheme = (value: string | undefined): SiteTheme | undefined => {
  return SiteTheme.find((theme) => theme === value);
};
const validateSidebarPosition = (value: string | undefined): SidebarPosition | undefined => {
  return SidebarPosition.find((position) => position === value);
};
const validateBoolean = (value: string | undefined): string | undefined => {
  if (value === "true" || value === "false") return value;
  return undefined;
};

/**
 * The provider for {@link SettingsContext}
 */
export const SettingsProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [siteTheme, setSiteTheme] = useLocalStorage<SiteTheme>({
    key: KEY_SITE_THEME,
    defaultValue: DEFAULT_SITE_SETTINGS.siteTheme,
    validator: validateSiteTheme,
  });
  const [sidebarPosition, setSidebarPosition] = useLocalStorage<SidebarPosition>({
    key: KEY_SIDEBAR_POSITION,
    defaultValue: DEFAULT_SITE_SETTINGS.sidebarPosition,
    validator: validateSidebarPosition,
  });
  const [recentActivity, setRecentActivity] = useLocalStorage<string>({
    key: KEY_RECENT_ACTIVITY,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableRecentActivity),
    validator: validateBoolean,
  });
  const [virtualLevels, setVirtualLevels] = useLocalStorage<string>({
    key: KEY_VIRTUAL_LEVELS,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableVirtualLevels),
    validator: validateBoolean,
  });

  const enableRecentActivity = recentActivity === "true";
  const setEnableRecentActivity = (value: boolean): void => {
    setRecentActivity(String(value));
  };

  const enableVirtualLevels = virtualLevels === "true";
  const setEnableVirtualLevels = (value: boolean): void => {
    setVirtualLevels(String(value));
  };

  const [skillProgressBars, setSkillProgressBars] = useLocalStorage<string>({
    key: KEY_SKILL_PROGRESS_BARS,
    defaultValue: String(DEFAULT_SITE_SETTINGS.enableSkillProgressBars),
    validator: validateBoolean,
  });

  const enableSkillProgressBars = skillProgressBars === "true";
  const setEnableSkillProgressBars = (value: boolean): void => {
    setSkillProgressBars(String(value));
  };

  return (
    <SettingsContext
      value={{
        siteTheme,
        sidebarPosition,
        setSidebarPosition,
        setSiteTheme,
        enableRecentActivity,
        setEnableRecentActivity,
        enableVirtualLevels,
        setEnableVirtualLevels,
        enableSkillProgressBars,
        setEnableSkillProgressBars,
      }}
    >
      {children}
    </SettingsContext>
  );
};
