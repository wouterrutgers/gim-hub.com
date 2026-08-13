import { decomposeExperience } from "../game/skill";

export function computeActivity(snapshot, current) {
  const skillChanges = [];
  if (current.skills) {
    for (const [skill, experienceAfter] of Object.entries(current.skills)) {
      const experienceBefore = snapshot.skills[skill] ?? 0;
      if (experienceAfter > experienceBefore) {
        skillChanges.push({
          skill,
          experienceBefore,
          experienceAfter,
          levelBefore: decomposeExperience(experienceBefore).levelReal,
          levelAfter: decomposeExperience(experienceAfter).levelReal,
        });
      }
    }
  }
  const questChanges = [];
  if (current.quests) {
    for (const [questId, statusAfter] of current.quests) {
      const statusBefore = snapshot.quests[String(questId)];
      if (statusAfter !== statusBefore) {
        questChanges.push({
          questId,
          statusBefore,
          statusAfter,
        });
      }
    }
  }
  const diaryChanges = [];
  if (current.diaries) {
    for (const [region, tierMap] of Object.entries(current.diaries)) {
      for (const [tier, tasks] of Object.entries(tierMap)) {
        const oldTasks = snapshot.diaries[region]?.[tier] ?? [];
        const newlyCompletedIndices = [];
        for (let index = 0; index < tasks.length; index++) {
          if (tasks[index] && !oldTasks[index]) {
            newlyCompletedIndices.push(index);
          }
        }
        if (newlyCompletedIndices.length > 0) {
          diaryChanges.push({
            region,
            tier,
            newlyCompletedIndices,
          });
        }
      }
    }
  }
  const collectionChanges = [];
  if (current.collection) {
    for (const [itemId, quantityAfter] of current.collection) {
      const quantityBefore = snapshot.collection[String(itemId)] ?? 0;
      if (quantityAfter > quantityBefore) {
        collectionChanges.push({
          itemId,
          quantityBefore,
          quantityAfter,
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
}

export function activityHasChanges(activity) {
  return (
    activity.skillChanges.length > 0 ||
    activity.questChanges.length > 0 ||
    activity.diaryChanges.length > 0 ||
    activity.collectionChanges.length > 0
  );
}
