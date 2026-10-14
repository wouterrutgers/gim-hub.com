import { skillIcons } from "./skill";

export function formatActivityNumber(value) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function activityPresentation(entry, gameData) {
  const data = entry.data;

  if (entry.type === "xp") {
    const skills = Object.entries(data.skills).sort(function largestGain(left, right) {
      return right[1] - left[1];
    });

    return {
      icon: skillIcons[skills[0][0]],
      text: `Gained ${formatActivityNumber(
        skills.reduce(function total(sum, skill) {
          return sum + skill[1];
        }, 0),
      )} XP`,
      details: skills.map(function skillDetail([skill, quantity]) {
        return `${skill}: +${quantity.toLocaleString()} XP`;
      }),
      skills: skills.map(function skillName([skill]) {
        return skill;
      }),
    };
  }

  if (entry.type === "level") {
    return {
      icon: skillIcons[data.skill],
      text: `Reached level ${data.after} ${data.skill}`,
      details: [`Level ${data.before} → ${data.after}`],
      milestone: data.after === 99,
    };
  }

  if (entry.type === "boss") {
    return {
      icon: "/ui/216-0.png",
      text: `${data.boss}: ${data.count.toLocaleString()} ${data.count_type}${data.count === 1 ? "" : "s"}`,
      details: [`Total kill count: ${data.total_count.toLocaleString()}`],
    };
  }

  if (entry.type === "quest") {
    return { icon: "/ui/776-0.png", text: `Completed ${data.quest_name}`, details: [], milestone: true };
  }

  if (entry.type === "diary") {
    const tasks = gameData.diaries?.get(data.region)?.get(data.tier);

    return {
      icon: "/ui/1298-0.png",
      text: data.complete
        ? `Completed the ${data.tier.toLowerCase()} ${data.region} diary`
        : `${data.region} ${data.tier.toLowerCase()} diary: ${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"}`,
      details: data.tasks.map(function taskDescription(index) {
        return tasks?.[index]?.task ?? `Task ${index + 1}`;
      }),
      milestone: data.complete,
    };
  }

  const item = gameData.items?.get(data.item_id);

  return {
    icon: `/item-icons/${data.item_id}.webp`,
    text: `${data.new_collection_item && data.source === "Collection log" ? "Unlocked" : "Received"} ${data.quantity > 1 ? `${data.quantity.toLocaleString()} × ` : ""}${item?.name ?? `Item ${data.item_id}`}`,
    details: [
      data.source === "Collection log" ? "Collection log unlock" : `From ${data.source}`,
      ...(data.value > 0 ? [`Value: ${data.value.toLocaleString()} GP`] : []),
    ],
    milestone: data.new_collection_item,
    collectionUnlock: data.new_collection_item,
  };
}

export function activityIsLive(entry, timestamp) {
  const minutes = entry.type === "boss" ? 30 : 15;

  return ["xp", "boss", "diary", "collection"].includes(entry.type) && timestamp - entry.occurred_at < minutes * 60_000;
}
