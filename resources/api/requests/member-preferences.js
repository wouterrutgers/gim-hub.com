import * as z from "zod/v4";
import { request } from "../request";
import { siteThemes } from "../../stores/settings-options";

export const preferencesSchema = z.object({
  siteTheme: z.enum(siteThemes).optional(),
  pageBackgroundOpacity: z.number().int().min(0).max(100).optional(),
  enableVirtualLevels: z.boolean().optional(),
  enableSkillProgressBars: z.boolean().optional(),
  enableGearscapeExport: z.boolean().optional(),
  expandPlayerHistory: z.boolean().optional(),
  collapseNavigation: z.boolean().optional(),
  showItemOwners: z.boolean().optional(),
  showActivitySidebar: z.boolean().optional(),
  filterActivityDrops: z.boolean().optional(),
  pinnedItemIds: z.array(z.number().int().positive()).optional(),
  dismissedPluginWarningVersions: z.string().optional(),
  seenChangelogIds: z.array(z.string().min(1)).optional(),
});

export async function fetchMemberPreferences({ baseURL, credentials, memberId, changes }) {
  const response = await request(`${baseURL}/group/${credentials.name}/members/${memberId}/preferences`, {
    method: changes ? "PATCH" : "GET",
    headers: { Authorization: credentials.token, "Content-Type": "application/json" },
    ...(changes ? { body: JSON.stringify(changes) } : {}),
  });

  if (!response.ok) {
    throw new Error("Could not load or save player preferences.", { cause: response });
  }

  const result = z.object({ preferences: preferencesSchema.nullable() }).parse(await response.json());

  return result.preferences;
}
