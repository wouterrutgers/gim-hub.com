import { skills } from "../../game/skill";
import {
  DEFAULT_SKILLS,
  EXPERIENCE_80,
  EXPERIENCE_90,
  EXPERIENCE_99,
  MAX_DIARY,
  MAX_QUEST,
  MILLISECONDS_PER_DAY,
} from "./fixtures";

export function createSkillsSnapshot(skillExperience, reductions) {
  const snapshot = {};

  for (const skill of skills) {
    snapshot[skill] = Math.max(0, skillExperience[skill] - (reductions[skill] ?? 0));
  }

  return snapshot;
}

export function createQuestSnapshot(statuses, quests, unfinishedQuestCount = 0) {
  const snapshot = {};
  const questIdentifiers = [...(quests?.keys() ?? [])];

  for (const [index, questIdentifier] of questIdentifiers.entries()) {
    snapshot[String(questIdentifier)] = statuses[index] ?? "NOT_STARTED";
  }

  for (const questIdentifier of questIdentifiers.slice(0, unfinishedQuestCount)) {
    snapshot[String(questIdentifier)] = "IN_PROGRESS";
  }

  return snapshot;
}

export function createDiarySnapshot(diaries, removals) {
  const snapshot = {};

  for (const [region, tiers] of Object.entries(diaries)) {
    snapshot[region] = {
      Easy: [...tiers.Easy],
      Medium: [...tiers.Medium],
      Hard: [...tiers.Hard],
      Elite: [...tiers.Elite],
    };
  }

  for (const { region, tier, taskCount } of removals) {
    snapshot[region][tier] = snapshot[region][tier].map(function removeTask(completed, index) {
      return index < taskCount ? false : completed;
    });
  }

  return snapshot;
}

export function createCollectionSnapshot(collection, reductions) {
  const snapshot = {};

  for (const [itemIdentifier, quantity] of collection ?? []) {
    snapshot[String(itemIdentifier)] = Math.max(0, quantity - (reductions[itemIdentifier] ?? 0));
  }

  return snapshot;
}

export function createBossKillCountSnapshot(hiscores, reductions) {
  const snapshot = {};

  for (const [boss, reduction] of Object.entries(reductions)) {
    snapshot[boss] = Math.max(0, (hiscores?.get(boss) ?? 0) - reduction);
  }

  return snapshot;
}

export function populateSnapshotHistory(state, gameData) {
  const cowName = "Cow31337Killer";
  const gamerName = "xXgamerXx";
  const weekAgo = Date.now() - 7 * MILLISECONDS_PER_DAY;
  const dayAgo = Date.now() - MILLISECONDS_PER_DAY;
  const cowSkills = {
    ...state.cowKiller.skills,
    Attack: EXPERIENCE_99,
    Defence: EXPERIENCE_99,
    Prayer: EXPERIENCE_80,
    Strength: EXPERIENCE_99,
    Hitpoints: EXPERIENCE_90,
  };
  const gamerSkills = {
    ...DEFAULT_SKILLS,
  };
  for (const skill of skills) {
    gamerSkills[skill] = EXPERIENCE_99;
  }
  state.collections.get(cowName)?.set(12932, 1);
  state.collections.get(cowName)?.set(12922, 2);
  state.collections.get(cowName)?.set(4716, 1);
  state.collections.get(gamerName)?.set(27277, 1);
  state.collections.get(gamerName)?.set(26219, 2);
  state.collections.get(gamerName)?.set(27279, 4);
  state.hiscores.get(cowName)?.set("Zulrah", 87);
  state.hiscores.get(cowName)?.set("Barrows Chests", 134);
  state.hiscores.get(gamerName)?.set("Tombs of Amascut", 312);
  state.hiscores.get(gamerName)?.set("Tombs of Amascut: Expert Mode", 94);
  state.snapshots.set(cowName, [
    {
      timestamp: weekAgo,
      skills: createSkillsSnapshot(cowSkills, {
        Strength: 240_000,
        Hitpoints: 80_000,
        Slayer: 120_000,
      }),
      quests: createQuestSnapshot(state.cowKiller.quests, gameData.quests),
      diaries: createDiarySnapshot(state.cowKiller.diaries, [
        {
          region: "Morytania",
          tier: "Medium",
          taskCount: 2,
        },
        {
          region: "Western Provinces",
          tier: "Hard",
          taskCount: 1,
        },
      ]),
      collection: createCollectionSnapshot(state.collections.get(cowName), {
        [12932]: 1,
        [12922]: 1,
        [4716]: 1,
      }),
      bossKc: createBossKillCountSnapshot(state.hiscores.get(cowName), {
        Zulrah: 14,
        "Barrows Chests": 21,
      }),
    },
    {
      timestamp: dayAgo,
      skills: createSkillsSnapshot(cowSkills, {
        Strength: 80_000,
        Hitpoints: 25_000,
        Slayer: 35_000,
      }),
      quests: createQuestSnapshot(state.cowKiller.quests, gameData.quests),
      diaries: createDiarySnapshot(state.cowKiller.diaries, [
        {
          region: "Western Provinces",
          tier: "Hard",
          taskCount: 1,
        },
      ]),
      collection: createCollectionSnapshot(state.collections.get(cowName), {
        [12922]: 1,
      }),
      bossKc: createBossKillCountSnapshot(state.hiscores.get(cowName), {
        Zulrah: 4,
        "Barrows Chests": 6,
      }),
    },
  ]);
  state.snapshots.set(gamerName, [
    {
      timestamp: weekAgo,
      skills: createSkillsSnapshot(gamerSkills, {
        Ranged: 1_200_000,
        Magic: 1_500_000,
        Slayer: 900_000,
      }),
      quests: createQuestSnapshot(MAX_QUEST, gameData.quests, 4),
      diaries: createDiarySnapshot(MAX_DIARY, [
        {
          region: "Kourend & Kebos",
          tier: "Elite",
          taskCount: 3,
        },
        {
          region: "Desert",
          tier: "Elite",
          taskCount: 2,
        },
      ]),
      collection: createCollectionSnapshot(state.collections.get(gamerName), {
        [27277]: 1,
        [26219]: 1,
        [27279]: 3,
      }),
      bossKc: createBossKillCountSnapshot(state.hiscores.get(gamerName), {
        "Tombs of Amascut": 32,
        "Tombs of Amascut: Expert Mode": 11,
      }),
    },
    {
      timestamp: dayAgo,
      skills: createSkillsSnapshot(gamerSkills, {
        Ranged: 300_000,
        Magic: 350_000,
        Slayer: 200_000,
      }),
      quests: createQuestSnapshot(MAX_QUEST, gameData.quests, 1),
      diaries: createDiarySnapshot(MAX_DIARY, [
        {
          region: "Desert",
          tier: "Elite",
          taskCount: 1,
        },
      ]),
      collection: createCollectionSnapshot(state.collections.get(gamerName), {
        [27279]: 1,
      }),
      bossKc: createBossKillCountSnapshot(state.hiscores.get(gamerName), {
        "Tombs of Amascut": 8,
        "Tombs of Amascut: Expert Mode": 2,
      }),
    },
  ]);
}
