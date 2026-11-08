import * as z from "zod/v4";
import { preferencesSchema } from "../api/requests/member-preferences";

const displayPreferencesSchema = preferencesSchema.omit({ seenChangelogIds: true });
const snapshotSchema = z.object({
  memberId: z.number().int().positive(),
  preferences: displayPreferencesSchema,
});

export function readCachedPlayerPreferences(groupName = localStorage.getItem("groupName")) {
  try {
    const selection = JSON.parse(localStorage.getItem("selected-players") ?? "{}")[groupName];
    const snapshot = snapshotSchema.safeParse(JSON.parse(localStorage.getItem(`player-preferences:${groupName}`)));

    return snapshot.success && snapshot.data.memberId === selection ? snapshot.data.preferences : undefined;
  } catch {
    return undefined;
  }
}

export function cachePlayerPreferences(groupName, memberId, preferences) {
  localStorage.setItem(
    `player-preferences:${groupName}`,
    JSON.stringify({ memberId, preferences: displayPreferencesSchema.parse(preferences) }),
  );
}

export function clearCachedPlayerPreferences(groupName) {
  localStorage.removeItem(`player-preferences:${groupName}`);
}
