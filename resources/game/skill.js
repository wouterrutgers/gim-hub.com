export const skills = [
  "Agility",
  "Attack",
  "Construction",
  "Cooking",
  "Crafting",
  "Defence",
  "Farming",
  "Firemaking",
  "Fishing",
  "Fletching",
  "Herblore",
  "Hitpoints",
  "Hunter",
  "Magic",
  "Mining",
  "Prayer",
  "Ranged",
  "Runecraft",
  "Sailing",
  "Slayer",
  "Smithing",
  "Strength",
  "Thieving",
  "Woodcutting",
];
export const skillIcons = {
  Overall: "/ui/3579-0.png",
  Attack: "/ui/197-0.png",
  Hitpoints: "/ui/203-0.png",
  Mining: "/ui/209-0.png",
  Strength: "/ui/198-0.png",
  Agility: "/ui/204-0.png",
  Smithing: "/ui/210-0.png",
  Defence: "/ui/199-0.png",
  Herblore: "/ui/205-0.png",
  Fishing: "/ui/211-0.png",
  Ranged: "/ui/200-0.png",
  Thieving: "/ui/206-0.png",
  Cooking: "/ui/212-0.png",
  Prayer: "/ui/201-0.png",
  Crafting: "/ui/207-0.png",
  Firemaking: "/ui/213-0.png",
  Magic: "/ui/202-0.png",
  Fletching: "/ui/208-0.png",
  Woodcutting: "/ui/214-0.png",
  Runecraft: "/ui/215-0.png",
  Sailing: "/ui/sailing.png",
  Slayer: "/ui/216-0.png",
  Farming: "/ui/217-0.png",
  Construction: "/ui/221-0.png",
  Hunter: "/ui/220-0.png",
};
const levelLookup = new Map();
{
  let xp = 0;
  for (let L = 1; L <= 126; L++) {
    levelLookup.set(L, Math.floor(xp));
    xp += 0.25 * Math.floor(L + 300 * 2 ** (L / 7));
  }
}
export function computeVirtualLevelFromXP(xp) {
  let virtualLevel = 1;
  while (xp >= (levelLookup.get(virtualLevel + 1) ?? Infinity)) virtualLevel += 1;
  return virtualLevel;
}
const LEVEL_MAX = 99;
export function decomposeExperience(xp) {
  const levelVirtual = computeVirtualLevelFromXP(xp);
  const levelReal = Math.min(levelVirtual, LEVEL_MAX);
  const xpMilestoneOfCurrent = levelLookup.get(levelVirtual) ?? 0;
  const xpMilestoneOfNext = levelLookup.get(levelVirtual + 1) ?? 0;
  return {
    levelVirtual: levelVirtual,
    levelReal: levelReal,
    xpMilestoneOfCurrent: xpMilestoneOfCurrent,
    xpMilestoneOfNext: xpMilestoneOfNext,
    xpDeltaFromMax: levelLookup.get(LEVEL_MAX),
  };
}
