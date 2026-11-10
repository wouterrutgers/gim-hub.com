import { activityWeek } from "../../game/activity";

export function populateActivity(state) {
  const now = Date.now();
  const samples = [
    ["Cow31337Killer", "xp", 5, { skills: { Strength: 3400, Hitpoints: 1100 } }],
    [
      "xXgamerXx",
      "loot",
      12,
      { item_id: 34669, quantity: 250, value: 500_000, source: "The Fractured Archive", new_collection_item: true },
    ],
    ["xXgamerXx", "boss", 18, { boss: "The Fractured Archive", count_type: "completion", count: 1, total_count: 47 }],
    [
      "Thurgo",
      "diary",
      35,
      {
        region: "Kourend & Kebos",
        tier: "Easy",
        tasks: Array.from({ length: 12 }, (_, index) => index),
        complete: true,
      },
    ],
    ["xXgamerXx", "level", 52, { skill: "Runecraft", before: 98, after: 99 }],
    ["Cow31337Killer", "quest", 80, { quest_id: 34, quest_name: "Druidic Ritual" }],
    ["Thurgo", "xp", 25 * 60, { skills: { Cooking: 28_560 } }],
    ["Cow31337Killer", "xp", 42 * 24 * 60, { skills: { Strength: 125_000, Hitpoints: 41_000 } }],
    ["Thurgo", "xp", 2, { skills: { Cooking: 8736, Smithing: 2250 } }],
    ["Thurgo", "level", 45, { skill: "Cooking", before: 43, after: 44 }],
    ["Thurgo", "quest", 2 * 24 * 60 + 90, { quest_id: 83, quest_name: "The Knight's Sword" }],
    ["Thurgo", "boss", 3 * 24 * 60 + 60, { boss: "Scurrius", count_type: "kill", count: 8, total_count: 24 }],
    [
      "Thurgo",
      "loot",
      3 * 24 * 60 + 65,
      { item_id: 28798, quantity: 1, value: 0, source: "Scurrius", new_collection_item: true },
    ],
    ["Cow31337Killer", "level", 65, { skill: "Strength", before: 89, after: 90 }],
    ["Cow31337Killer", "boss", 24 * 60 + 40, { boss: "Vorkath", count_type: "kill", count: 12, total_count: 312 }],
    [
      "Cow31337Killer",
      "loot",
      24 * 60 + 45,
      { item_id: 11286, quantity: 1, value: 2_500_000, source: "Vorkath", new_collection_item: true },
    ],
    [
      "Cow31337Killer",
      "diary",
      2 * 24 * 60 + 70,
      { region: "Lumbridge & Draynor", tier: "Hard", tasks: [0, 1, 2], complete: false },
    ],
    ["Gary", "xp", 3, { skills: { Mining: 12_500, Smithing: 7800 } }],
    ["Gary", "level", 40, { skill: "Mining", before: 71, after: 72 }],
    ["Gary", "quest", 90, { quest_id: 30, quest_name: "Doric's Quest" }],
    ["Gary", "boss", 24 * 60 + 30, { boss: "The Gauntlet", count_type: "completion", count: 6, total_count: 86 }],
    [
      "Gary",
      "loot",
      24 * 60 + 35,
      { item_id: 23956, quantity: 1, value: 5_000_000, source: "The Gauntlet", new_collection_item: true },
    ],
    ["Gary", "diary", 2 * 24 * 60 + 50, { region: "Varrock", tier: "Medium", tasks: [0, 1], complete: false }],
    ["xXgamerXx", "xp", 4, { skills: { Ranged: 18_600, Hitpoints: 6200 } }],
    ["xXgamerXx", "quest", 24 * 60 + 80, { quest_id: 86, quest_name: "Lost City" }],
    [
      "xXgamerXx",
      "diary",
      2 * 24 * 60 + 60,
      { region: "Western Provinces", tier: "Hard", tasks: [0, 1, 2, 3], complete: false },
    ],
    ["Thurgo", "xp", 42 * 24 * 60, { skills: { Cooking: 145_000, Smithing: 32_500 } }],
    ["Gary", "xp", 42 * 24 * 60, { skills: { Mining: 185_000, Smithing: 96_000 } }],
    ["xXgamerXx", "xp", 42 * 24 * 60, { skills: { Ranged: 245_000, Hitpoints: 81_000 } }],
  ];

  for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
    samples.push(
      ["Thurgo", "xp", day * 24 * 60 + 20, { skills: { Cooking: 18_720, Smithing: 4500 } }],
      ["Cow31337Killer", "xp", day * 24 * 60 + 30, { skills: { Strength: 32_400, Hitpoints: 10_800, Slayer: 7200 } }],
      ["Gary", "xp", day * 24 * 60 + 40, { skills: { Mining: 25_000, Smithing: 15_600 } }],
      ["xXgamerXx", "xp", day * 24 * 60 + 50, { skills: { Ranged: 42_000, Hitpoints: 14_000, Runecraft: 8500 } }],
    );
  }

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
