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
}

const DEFAULT_SITE_SETTINGS = Object.freeze({
  sidebarPosition: "left",
  siteTheme: "light",
  enableRecentActivity: true,
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

interface RecentActivitySettings {
  enabled: boolean;
  intervalMinutes?: number;
}

const DEFAULT_RECENT_ACTIVITY: RecentActivitySettings = {
  enabled: true,
};

const validateSiteTheme = (value: string | undefined): SiteTheme | undefined => {
  return SiteTheme.find((theme) => theme === value);
};
const validateSidebarPosition = (value: string | undefined): SidebarPosition | undefined => {
  return SidebarPosition.find((position) => position === value);
};
const validateRecentActivitySettings = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.enabled !== "boolean") return undefined;
    if (
      obj.intervalMinutes !== undefined &&
      (typeof obj.intervalMinutes !== "number" || !Number.isInteger(obj.intervalMinutes) || obj.intervalMinutes < 0)
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
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
  const [recentActivityStr, setRecentActivityStr] = useLocalStorage<string>({
    key: KEY_RECENT_ACTIVITY,
    defaultValue: JSON.stringify(DEFAULT_RECENT_ACTIVITY),
    validator: validateRecentActivitySettings,
  });

  let recentActivity: RecentActivitySettings;
  try {
    recentActivity = JSON.parse(recentActivityStr) as RecentActivitySettings;
  } catch {
    recentActivity = DEFAULT_RECENT_ACTIVITY;
  }

  const enableRecentActivity = recentActivity.enabled;

  const setEnableRecentActivity = (value: boolean): void => {
    setRecentActivityStr(JSON.stringify({ ...recentActivity, enabled: value }));
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
      }}
    >
      {children}
    </SettingsContext>
  );
};
