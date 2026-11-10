import { combineActivityEntries } from "./activity-summary";
import { activityPresentation } from "./activity";
import { skillIcons } from "./skill";

export function activityComparisonRows(entries, gameData) {
  const rows = [];

  for (const entry of combineActivityEntries(entries)) {
    const data = entry.data;
    const presentation = activityPresentation(entry, gameData);

    if (entry.type === "xp") {
      rows.push({
        key: "xp:total",
        category: "Skills",
        label: "Total XP",
        value: Object.values(data.skills)
          .reduce(function total(sum, quantity) {
            return sum + quantity;
          }, 0)
          .toLocaleString(),
      });

      for (const [skill, quantity] of Object.entries(data.skills)) {
        rows.push({
          key: `xp:${skill}`,
          category: "Skills",
          label: `${skill} XP`,
          icon: skillIcons[skill],
          value: quantity.toLocaleString(),
        });
      }

      continue;
    }

    if (entry.type === "level") {
      rows.push({
        key: `level:${data.skill}`,
        category: "Skills",
        label: `${data.skill} level`,
        icon: presentation.icon,
        value: `${data.before} → ${data.after}`,
      });

      continue;
    }

    if (entry.type === "boss") {
      rows.push({
        key: `boss:${data.boss}:${data.count_type}`,
        category: "Boss kills",
        label: `${data.boss} ${data.count_type}s`,
        icon: presentation.icon,
        value: data.count.toLocaleString(),
      });

      continue;
    }

    if (entry.type === "quest") {
      rows.push({
        key: `quest:${data.quest_id}`,
        category: "Quests",
        label: data.quest_name,
        icon: presentation.icon,
        value: "Completed",
      });

      continue;
    }

    if (entry.type === "diary") {
      rows.push({
        key: `diary:${data.region}:${data.tier}`,
        category: "Achievement diaries",
        label: `${data.region} (${data.tier.toLowerCase()})`,
        icon: presentation.icon,
        value: data.complete ? "Completed" : `${data.tasks.length} tasks`,
      });

      continue;
    }

    rows.push({
      key: `${entry.type}:${data.item_id}:${data.source}`,
      category: "Drops",
      label: `${gameData.items?.get(data.item_id)?.name ?? `Item ${data.item_id}`} (${data.source})`,
      icon: presentation.icon,
      value: `${data.quantity.toLocaleString()}${data.new_collection_item ? " · New collection item" : ""}`,
    });
  }

  return rows;
}

export function playerPeriodStatus(history, period) {
  if (!playerPeriodIsLoaded(history, period)) {
    return history.error ? "Unavailable" : "Loading…";
  }

  return "None";
}

export function playerPeriodIsLoaded(history, period) {
  if (!history.loaded) {
    return false;
  }

  if (
    !history.olderCursor ||
    history.periods.some(function recorded(candidate) {
      return candidate.key === period.key;
    })
  ) {
    return true;
  }

  const [kind, start] = history.olderCursor.split(":");

  return period.started_at > Number(start) || (period.started_at === Number(start) && period.kind >= kind);
}
