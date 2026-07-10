import mappings from "./mappings.json";

type MappingEntry = "kills" | { label: string; lookupKey: string }[] | [];

export const BOSS_KC_KEYS = new Set<string>(
  Object.entries(mappings as Record<string, MappingEntry>).flatMap(([pageName, entry]) => {
    if (entry === "kills") return [pageName];
    if (Array.isArray(entry)) return entry.map((e) => e.lookupKey);
    return [];
  }),
);
