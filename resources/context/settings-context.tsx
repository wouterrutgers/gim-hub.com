import { createContext, type ReactElement, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/local-storage";
import { SidebarPosition, SiteTheme } from "./settings-types";

interface Settings {
  siteTheme: SiteTheme;
  setSiteTheme?: (value: SiteTheme) => void;
  sidebarPosition: SidebarPosition;
  setSidebarPosition?: (value: SidebarPosition) => void;
}
const DEFAULT_SITE_SETTINGS = Object.freeze({ sidebarPosition: "left", siteTheme: "light" });

/* eslint-disable react-refresh/only-export-components */

/**
 * Provides user settings for the website, such as the position of the sidebar
 * and dark or light theme.
 */
export const SettingsContext = createContext<Settings>(DEFAULT_SITE_SETTINGS);

/* eslint-enable react-refresh/only-export-components */

const KEY_SITE_THEME = "settings-site-theme";
const KEY_SIDEBAR_POSITION = "settings-sidebar-position";

const validateSiteTheme = (value: string | undefined): SiteTheme | undefined => {
  const validated = SiteTheme.find((theme) => theme === value);
  return validated;
};
const validateSidebarPosition = (value: string | undefined): SidebarPosition | undefined => {
  const validated = SidebarPosition.find((position) => position === value);
  return validated;
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

  return (
    <SettingsContext value={{ siteTheme, sidebarPosition, setSidebarPosition, setSiteTheme }}>
      {children}
    </SettingsContext>
  );
};
