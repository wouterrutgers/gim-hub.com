import { parseGroupData } from "../requests/group-data";

export const EXPERIENCE_99 = 13034431;
export const EXPERIENCE_90 = 5346332;
export const EXPERIENCE_80 = 1986068;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_MEMBER = parseGroupData([
  {
    name: "",
  },
])[0];
export const DEFAULT_SKILLS = {
  Agility: 0,
  Attack: 0,
  Construction: 0,
  Cooking: 0,
  Crafting: 0,
  Defence: 0,
  Farming: 0,
  Firemaking: 0,
  Fishing: 0,
  Fletching: 0,
  Herblore: 0,
  Hitpoints: 1154,
  Hunter: 0,
  Magic: 0,
  Mining: 0,
  Prayer: 0,
  Ranged: 0,
  Runecraft: 0,
  Sailing: 0,
  Slayer: 0,
  Smithing: 0,
  Strength: 0,
  Thieving: 0,
  Woodcutting: 0,
};
export const MAX_QUEST = parseGroupData([
  {
    name: "",
    quests: new Array(400).fill(2),
  },
])[0].quests;
const MAX_DIARY_TIER = {
  Easy: new Array(20).fill(true),
  Medium: new Array(20).fill(true),
  Hard: new Array(20).fill(true),
  Elite: new Array(20).fill(true),
};
export const MAX_DIARY = {
  "Kourend & Kebos": MAX_DIARY_TIER,
  "Lumbridge & Draynor": MAX_DIARY_TIER,
  "Western Provinces": MAX_DIARY_TIER,
  Ardougne: MAX_DIARY_TIER,
  Desert: MAX_DIARY_TIER,
  Falador: MAX_DIARY_TIER,
  Fremennik: MAX_DIARY_TIER,
  Kandarin: MAX_DIARY_TIER,
  Karamja: MAX_DIARY_TIER,
  Morytania: MAX_DIARY_TIER,
  Varrock: MAX_DIARY_TIER,
  Wilderness: MAX_DIARY_TIER,
};
const INITIAL_STATE = {
  thurgo: {
    lastTick: 0,
    piesCookedInInventory: 0,
    piesUncookedInInventory: 28,
    piesCookedInBank: 0,
    piesUncookedInBank: 423425,
    bankingCooldown: 0,
  },
  cowKiller: {
    MAX_HIT: 28,
    COW_MAX_HP: 8,
    cowHP: 8,
    kills: 0,
    damageDone: 0,
    lastTick: 0,
    deathCooldown: 0,
    attackCooldown: 3,
    skills: DEFAULT_SKILLS,
    quests: MAX_QUEST,
    diaries: structuredClone(MAX_DIARY),
  },
  roster: [
    {
      displayName: "Thurgo",
      originalName: "Thurgo",
      colorHueDegrees: 230,
    },
    {
      displayName: "Cow31337Killer",
      originalName: "Cow31337Killer",
      colorHueDegrees: 330,
    },
    {
      displayName: "Gary",
      originalName: "Gary",
      colorHueDegrees: 100,
    },
    {
      displayName: "xXgamerXx",
      originalName: "xXgamerXx",
      colorHueDegrees: 170,
    },
  ],
  skillData: {
    Day: new Map(),
    Week: new Map(),
    Month: new Map(),
    Year: new Map(),
  },
  hiscores: new Map(),
  collections: new Map(),
  snapshots: new Map(),
  banks: new Map(),
  sharedBank: new Map(),
};

export function createInitialState() {
  return structuredClone(INITIAL_STATE);
}
