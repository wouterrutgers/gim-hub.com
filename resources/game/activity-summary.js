import { activityPresentation } from "./activity";

export function combineActivityEntries(entries) {
  const combined = new Map();

  for (const entry of entries) {
    const data = entry.data;
    const subject = {
      xp: [],
      level: [data.skill],
      boss: [data.boss, data.count_type],
      quest: [data.quest_id],
      diary: [data.region, data.tier],
      loot: [data.item_id, data.source],
      collection: [data.item_id, data.source],
    }[entry.type];
    const key = JSON.stringify([entry.type, ...subject]);
    const previous = combined.get(key);

    if (!previous) {
      combined.set(key, structuredClone(entry));

      continue;
    }

    const total = previous.data;

    if (entry.type === "xp") {
      for (const [skill, quantity] of Object.entries(data.skills)) {
        total.skills[skill] = (total.skills[skill] ?? 0) + quantity;
      }
    }

    if (entry.type === "level") {
      total.before = Math.min(total.before, data.before);
      total.after = Math.max(total.after, data.after);
    }

    if (entry.type === "boss") {
      total.count += data.count;
      total.total_count = Math.max(total.total_count, data.total_count);
    }

    if (entry.type === "diary") {
      total.tasks = [...new Set([...total.tasks, ...data.tasks])];
      total.complete ||= data.complete;
    }

    if (entry.type === "loot" || entry.type === "collection") {
      total.quantity += data.quantity;
      total.value += data.value;
      total.new_collection_item ||= data.new_collection_item;
    }
  }

  return [...combined.values()];
}

export function summarizeActivity(entries, gameData) {
  const categories = new Map([
    ["Skills", []],
    ["Boss kills", []],
    ["Quests", []],
    ["Achievement diaries", []],
    ["Drops", []],
  ]);

  for (const entry of combineActivityEntries(entries)) {
    const presentation = activityPresentation(entry, gameData);

    if (entry.type === "xp") {
      categories.get("Skills").push(...presentation.details);

      continue;
    }

    if (entry.type === "level") {
      categories
        .get("Skills")
        .push({ icon: presentation.icon, text: `${entry.data.skill}: ${presentation.details[0].text}` });

      continue;
    }

    const category = {
      boss: "Boss kills",
      quest: "Quests",
      diary: "Achievement diaries",
      loot: "Drops",
      collection: "Drops",
    }[entry.type];
    categories.get(category).push({
      icon: presentation.icon,
      text:
        category === "Drops"
          ? `${presentation.text} (${entry.data.source})${presentation.collectionUnlock ? " (new collection item)" : ""}`
          : presentation.text,
    });
  }

  return [...categories].filter(function hasRows([_label, rows]) {
    return rows.length > 0;
  });
}
