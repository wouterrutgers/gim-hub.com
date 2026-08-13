import mappings from "./mappings.json";

export const BOSS_KC_KEYS = new Set(
  Object.entries(mappings).flatMap(([pageName, entry]) => {
    if (entry === "kills") return [pageName];
    if (Array.isArray(entry)) return entry.map((e) => e.lookupKey);
    return [];
  }),
);
