import { activityWeek } from "../../game/activity";

export function populateActivity(state) {
  const now = Date.now();
  const samples = [
    ["Cow31337Killer", "xp", 5, { skills: { Attack: 3400, Hitpoints: 1100 } }],
    [
      "xXgamerXx",
      "loot",
      12,
      { item_id: 4151, quantity: 1, value: 1_800_000, source: "Abyssal Sire", new_collection_item: true },
    ],
    ["xXgamerXx", "boss", 18, { boss: "Vorkath", count_type: "kill", count: 12, total_count: 247 }],
    ["Thurgo", "diary", 35, { region: "Falador", tier: "Easy", tasks: [0, 1, 2], complete: false }],
    ["xXgamerXx", "level", 52, { skill: "Runecraft", before: 98, after: 99 }],
    ["Cow31337Killer", "quest", 80, { quest_id: 17, quest_name: "Druidic Ritual" }],
    ["Thurgo", "xp", 25 * 60, { skills: { Cooking: 28_560 } }],
    ["Cow31337Killer", "xp", 42 * 24 * 60, { skills: { Attack: 125_000, Hitpoints: 41_000 } }],
  ];

  for (const [index, [member, type, minutes, data]] of samples.entries()) {
    const rosterMember = state.roster.find(function matches(player) {
      return player.displayName === member;
    });
    state.activities.set(index + 1, {
      id: index + 1,
      member_id: rosterMember.id,
      revision: 1,
      type,
      started_at: minutes > 30 * 24 * 60 ? activityWeek(now - minutes * 60_000) : now - minutes * 60_000,
      occurred_at: now - minutes * 60_000,
      is_weekly: minutes > 30 * 24 * 60,
      data,
      updated_at: now,
    });
  }

  state.nextActivityIdentifier = samples.length + 1;
}

export function advanceActivity(state, members) {
  const now = Date.now();

  for (const member of members) {
    if (!member.skills) {
      continue;
    }

    const previous = state.activitySkills.get(member.id);
    state.activitySkills.set(member.id, { ...member.skills });

    if (!previous) {
      continue;
    }

    const gains = Object.entries(member.skills).filter(function increased([skill, experience]) {
      return experience > previous[skill];
    });

    if (gains.length === 0) {
      continue;
    }

    let entry = [...state.activities.values()].find(function activeTraining(activity) {
      return activity.type === "xp" && activity.member_id === member.id && now - activity.occurred_at < 15 * 60_000;
    });

    if (!entry) {
      entry = {
        id: state.nextActivityIdentifier++,
        member_id: member.id,
        type: "xp",
        revision: 0,
        started_at: now,
        occurred_at: now,
        is_weekly: false,
        data: { skills: {} },
      };
      state.activities.set(entry.id, entry);
    }

    for (const [skill, experience] of gains) {
      entry.data.skills[skill] = (entry.data.skills[skill] ?? 0) + experience - previous[skill];
    }

    entry.revision++;
    entry.occurred_at = now;
    entry.updated_at = now;
  }
}
