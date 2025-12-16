export const SidebarPosition = ["left", "right"] as const;
export type SidebarPosition = (typeof SidebarPosition)[number];

export const SiteTheme = ["light", "dark"] as const;
export type SiteTheme = (typeof SiteTheme)[number];
