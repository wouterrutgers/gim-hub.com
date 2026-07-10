import type { DiaryRegion, DiaryTier } from "../game/diaries";
import type { ItemID } from "../game/items";
import type { QuestID, QuestStatus } from "../game/quests";
import type { Experience, Skill } from "../game/skill";
import type * as Member from "../game/member";
import { decomposeExperience } from "../game/skill";

/**
 * A snapshot of a player's relevant tracked state at a point in time.
 */
export interface PlayerSnapshot {
  timestamp: number;
  skills: Partial<Record<Skill, number>>;
  quests: Record<string, QuestStatus>;
  diaries: Partial<Record<DiaryRegion, Partial<Record<DiaryTier, boolean[]>>>>;
  collection: Record<string, number>;
  bossKc?: Record<string, number>;
}

export interface SkillChange {
  skill: Skill;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
}

export interface QuestChange {
  questId: QuestID;
  statusBefore: QuestStatus | undefined;
  statusAfter: QuestStatus;
}

export interface DiaryChange {
  region: DiaryRegion;
  tier: DiaryTier;
  newlyCompletedIndices: number[];
}

export interface CollectionChange {
  itemId: ItemID;
  quantityBefore: number;
  quantityAfter: number;
}

export interface PlayerActivity {
  snapshotTimestamp: number;
  skillChanges: SkillChange[];
  questChanges: QuestChange[];
  diaryChanges: DiaryChange[];
  collectionChanges: CollectionChange[];
  bossKcBefore: Record<string, number>;
}

export const snapshotFromMemberState = (state: Member.State): Omit<PlayerSnapshot, "timestamp"> => {
  const skills: Partial<Record<Skill, number>> = {};
  if (state.skills) {
    for (const [skill, xp] of Object.entries(state.skills) as [Skill, Experience][]) {
      skills[skill] = xp;
    }
  }

  const quests: Record<string, QuestStatus> = {};
  if (state.quests) {
    for (const [id, status] of state.quests) {
      quests[String(id)] = status;
    }
  }

  const diaries: Partial<Record<DiaryRegion, Partial<Record<DiaryTier, boolean[]>>>> = {};
  if (state.diaries) {
    for (const [region, tierMap] of Object.entries(state.diaries) as [DiaryRegion, Record<DiaryTier, boolean[]>][]) {
      const diaryRegion: Partial<Record<DiaryTier, boolean[]>> = {};
      diaries[region] = diaryRegion;
      for (const [tier, tasks] of Object.entries(tierMap) as [DiaryTier, boolean[]][]) {
        diaryRegion[tier] = [...tasks];
      }
    }
  }

  const collection: Record<string, number> = {};
  if (state.collection) {
    for (const [id, qty] of state.collection) {
      collection[String(id)] = qty;
    }
  }

  return { skills, quests, diaries, collection };
};

export const computeActivity = (snapshot: PlayerSnapshot, current: Member.State): PlayerActivity => {
  const skillChanges: SkillChange[] = [];
  if (current.skills) {
    for (const [skill, xpAfter] of Object.entries(current.skills) as [Skill, Experience][]) {
      const xpBefore = snapshot.skills[skill] ?? 0;
      if (xpAfter > xpBefore) {
        skillChanges.push({
          skill,
          xpBefore,
          xpAfter,
          levelBefore: decomposeExperience(xpBefore as Experience).levelReal,
          levelAfter: decomposeExperience(xpAfter).levelReal,
        });
      }
    }
  }

  const questChanges: QuestChange[] = [];
  if (current.quests) {
    for (const [id, statusAfter] of current.quests) {
      const statusBefore = snapshot.quests[String(id)] as QuestStatus | undefined;
      if (statusAfter !== statusBefore) {
        questChanges.push({ questId: id, statusBefore, statusAfter });
      }
    }
  }

  const diaryChanges: DiaryChange[] = [];
  if (current.diaries) {
    for (const [region, tierMap] of Object.entries(current.diaries) as [DiaryRegion, Record<DiaryTier, boolean[]>][]) {
      for (const [tier, tasks] of Object.entries(tierMap) as [DiaryTier, boolean[]][]) {
        const oldTasks = snapshot.diaries[region]?.[tier] ?? [];
        const newlyCompletedIndices: number[] = [];
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i] && !oldTasks[i]) {
            newlyCompletedIndices.push(i);
          }
        }
        if (newlyCompletedIndices.length > 0) {
          diaryChanges.push({ region, tier, newlyCompletedIndices });
        }
      }
    }
  }

  const collectionChanges: CollectionChange[] = [];
  if (current.collection) {
    for (const [id, qtyAfter] of current.collection) {
      const qtyBefore = snapshot.collection[String(id)] ?? 0;
      if (qtyAfter > qtyBefore) {
        collectionChanges.push({
          itemId: id,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
        });
      }
    }
  }

  return {
    snapshotTimestamp: snapshot.timestamp,
    skillChanges,
    questChanges,
    diaryChanges,
    collectionChanges,
    bossKcBefore: snapshot.bossKc ?? {},
  };
};

export const activityHasChanges = (activity: PlayerActivity): boolean => {
  return (
    activity.skillChanges.length > 0 ||
    activity.questChanges.length > 0 ||
    activity.diaryChanges.length > 0 ||
    activity.collectionChanges.length > 0
  );
};
