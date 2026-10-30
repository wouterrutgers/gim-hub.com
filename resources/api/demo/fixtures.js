import { parseGroupData } from "../requests/group-data";

export const EXPERIENCE_99 = 13034431;
export const EXPERIENCE_90 = 5346332;
export const EXPERIENCE_80 = 1986068;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
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
export const DEFAULT_MEMBER = {
  ...parseGroupData([
    {
      id: 1,
      name: "",
    },
  ])[0],
  skills: DEFAULT_SKILLS,
};
export const MAX_QUEST = parseGroupData([
  {
    id: 1,
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
export const HOSIDIUS_KITCHEN_ROUTE = [
  [1678, 3621],
  [1677, 3620],
  [1676, 3619],
  [1676, 3618],
  [1676, 3617],
  [1676, 3616],
  [1676, 3615],
];
export const UNDEAD_COW_LOCATIONS = [
  [3617, 3525],
  [3620, 3525],
  [3620, 3528],
  [3617, 3528],
];
export const ARCHIVE_RANGED_EQUIPMENT = [
  ["Head", 27235],
  ["Cape", 28955],
  ["Amulet", 33639],
  ["Weapon", 20997],
  ["Body", 27238],
  ["Legs", 27241],
  ["Boots", 31097],
  ["Gloves", 26235],
  ["Ring", 28310],
  ["Ammo", 27544],
];
export const ARCHIVE_MELEE_EQUIPMENT = [
  ["Head", 24419],
  ["Cape", 21295],
  ["Amulet", 29801],
  ["Weapon", 34715],
  ["Body", 24420],
  ["Legs", 24421],
  ["Boots", 31097],
  ["Gloves", 22981],
  ["Ring", 28307],
  ["Ammo", 27544],
];
const INITIAL_STATE = {
  cowKiller: {
    skills: DEFAULT_SKILLS,
    quests: MAX_QUEST,
    diaries: structuredClone(MAX_DIARY),
  },
  roster: [
    {
      id: 1,
      displayName: "Thurgo",
      originalName: "Thurgo",
      colorHueDegrees: 230,
    },
    {
      id: 2,
      displayName: "Cow31337Killer",
      originalName: "Cow31337Killer",
      colorHueDegrees: 330,
    },
    {
      id: 3,
      displayName: "Gary",
      originalName: "Gary",
      colorHueDegrees: 100,
    },
    {
      id: 4,
      displayName: "xXgamerXx",
      originalName: "xXgamerXx",
      colorHueDegrees: 170,
    },
  ],
  skillData: new Map(),
  hiscores: new Map(),
  collections: new Map(),
  activities: new Map(),
  activitySkills: new Map(),
  nextActivityIdentifier: 1,
  nextMemberIdentifier: 6,
  banks: new Map(),
  sharedBank: new Map(),
};

export function createInitialState() {
  return structuredClone(INITIAL_STATE);
}
