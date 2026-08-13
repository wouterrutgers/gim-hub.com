import { skills } from "../../game/skill";
import {
  DEFAULT_MEMBER,
  DEFAULT_SKILLS,
  EXPERIENCE_80,
  EXPERIENCE_90,
  EXPERIENCE_99,
  MAX_DIARY,
  MAX_QUEST,
} from "./fixtures";

export function mockGroupDataResponse({ roster, thurgo, cowKiller, banks, sharedBank }, startMS, demoData) {
  const results = [];
  startMS ??= performance.now();
  const elapsedMS = performance.now() - startMS;
  const thurgoRoster = roster.find(({ originalName }) => originalName === "Thurgo");
  if (thurgoRoster) {
    const member = {
      ...DEFAULT_MEMBER,
      name: thurgoRoster.displayName,
      bank: banks.get("Thurgo"),
      stats: {
        health: {
          current: 99,
          max: 99,
        },
        prayer: {
          current: 1,
          max: 1,
        },
        run: {
          current: 100,
          max: 100,
        },
        world: 201,
        specialAttack: {
          current: 100,
          max: 100,
        },
      },
      coordinates: {
        x: 2465,
        y: 2848,
        plane: 1,
        isOnBoat: false,
      },
    };
    member.lastUpdated = new Date(Date.now());
    while (thurgo.lastTick < Math.floor(elapsedMS / 600)) {
      const banking = thurgo.bankingCooldown > 0;
      if (banking) {
        thurgo.bankingCooldown -= 1;
        if (thurgo.bankingCooldown <= 4) {
          thurgo.piesCookedInBank += thurgo.piesCookedInInventory;
          thurgo.piesUncookedInBank += thurgo.piesUncookedInInventory;
          thurgo.piesCookedInInventory = 0;
          thurgo.piesUncookedInInventory = 0;
        }
        if (thurgo.bankingCooldown <= 0) {
          thurgo.piesUncookedInBank -= 28;
          thurgo.piesUncookedInInventory = 28;
          thurgo.bankingCooldown = 0;
        }
      } else {
        thurgo.piesCookedInInventory += 1;
        thurgo.piesUncookedInInventory -= 1;
        if (thurgo.piesCookedInInventory >= 28) {
          thurgo.piesCookedInInventory = 28;
          thurgo.piesUncookedInInventory = 0;
          thurgo.bankingCooldown = 8;
        }
      }
      thurgo.lastTick += 1;
    }
    const REDBERRY_PIE_COOKED = 2325;
    const REDBERRY_PIE_UNCOOKED = 2321;
    member.bank = new Map([
      [
        REDBERRY_PIE_UNCOOKED,
        {
          itemID: REDBERRY_PIE_UNCOOKED,
          quantity: thurgo.piesUncookedInBank,
        },
      ],
      [
        REDBERRY_PIE_COOKED,
        {
          itemID: REDBERRY_PIE_COOKED,
          quantity: thurgo.piesCookedInBank,
        },
      ],
    ]);
    member.skills = {
      ...DEFAULT_SKILLS,
      Cooking: 61512 + (thurgo.piesCookedInBank + thurgo.piesCookedInInventory) * 78,
    };
    member.inventory = new Map();
    let slot = 0;
    for (let i = 0; i < thurgo.piesCookedInInventory; i++) {
      member.inventory.set(slot++, {
        itemID: REDBERRY_PIE_COOKED,
        quantity: 1,
      });
    }
    for (let i = 0; i < thurgo.piesUncookedInInventory; i++) {
      member.inventory.set(slot++, {
        itemID: REDBERRY_PIE_UNCOOKED,
        quantity: 1,
      });
    }
    results.push(member);
  }
  const cow31337KillerRoster = roster.find(({ originalName }) => originalName === "Cow31337Killer");
  if (cow31337KillerRoster) {
    const member = {
      ...DEFAULT_MEMBER,
      name: cow31337KillerRoster.displayName,
      bank: banks.get("Cow31337Killer"),
      quests: [...cowKiller.quests],
      diaries: {
        ...cowKiller.diaries,
      },
      skills: {
        ...cowKiller.skills,
      },
      stats: {
        health: {
          current: 90,
          max: 90,
        },
        prayer: {
          current: 80,
          max: 80,
        },
        run: {
          current: 100,
          max: 100,
        },
        world: 201,
        specialAttack: {
          current: 100,
          max: 100,
        },
      },
      equipment: new Map([
        [
          "Weapon",
          {
            itemID: 25516,
            quantity: 1,
          },
        ],
        [
          "Head",
          {
            itemID: 4716,
            quantity: 1,
          },
        ],
        [
          "Cape",
          {
            itemID: 21295,
            quantity: 1,
          },
        ],
        [
          "Body",
          {
            itemID: 20421,
            quantity: 1,
          },
        ],
        [
          "Legs",
          {
            itemID: 1093,
            quantity: 1,
          },
        ],
        [
          "Boots",
          {
            itemID: 4131,
            quantity: 1,
          },
        ],
        [
          "Gloves",
          {
            itemID: 1495,
            quantity: 1,
          },
        ],
      ]),
      coordinates: {
        x: 3616,
        y: 3525,
        plane: 0,
        isOnBoat: false,
      },
      lastUpdated: new Date(Date.now()),
    };
    while (cowKiller.lastTick < elapsedMS / 600) {
      cowKiller.attackCooldown -= 1;
      if (cowKiller.attackCooldown <= 0) {
        const damage = Math.max(Math.min(cowKiller.cowHP, Math.floor(Math.random() * (cowKiller.MAX_HIT + 1))), 1);
        cowKiller.cowHP -= damage;
        cowKiller.damageDone += damage;
        if (cowKiller.cowHP <= 0) {
          cowKiller.deathCooldown = 5;
        }
        cowKiller.attackCooldown = 7;
      }
      cowKiller.deathCooldown -= 1;
      if (cowKiller.deathCooldown == 0) {
        cowKiller.cowHP = cowKiller.COW_MAX_HP;
      }
      cowKiller.deathCooldown = Math.max(0, cowKiller.deathCooldown);
      cowKiller.lastTick += 1;
    }
    member.skills = {
      ...member.skills,
      Attack: EXPERIENCE_99,
      Defence: EXPERIENCE_99,
      Prayer: EXPERIENCE_80,
      Strength: EXPERIENCE_99 + 4 * cowKiller.damageDone,
      Hitpoints: Math.floor(EXPERIENCE_90 + (4 / 3) * cowKiller.damageDone),
    };
    member.interacting = {
      name: "Undead Cow",
      healthRatio: cowKiller.cowHP / cowKiller.COW_MAX_HP,
      location: {
        x: 3617,
        y: 3525,
        plane: 1,
      },
      lastUpdated: new Date(Date.now()),
    };
    results.push(member);
  }
  const garyRoster = roster.find(({ originalName }) => originalName === "Gary");
  if (garyRoster) {
    const member = {
      ...DEFAULT_MEMBER,
      name: garyRoster.displayName,
      bank: banks.get("Gary"),
      stats: {
        health: {
          current: 10,
          max: 10,
        },
        prayer: {
          current: 1,
          max: 1,
        },
        run: {
          current: 100,
          max: 100,
        },
        world: 201,
        specialAttack: {
          current: 100,
          max: 100,
        },
      },
      lastUpdated: new Date(Date.now()),
      equipment: new Map([
        [
          "Weapon",
          {
            itemID: 1265,
            quantity: 1,
          },
        ],
        [
          "Shield",
          {
            itemID: 1171,
            quantity: 1,
          },
        ],
      ]),
      interacting: {
        name: "Dark wizard",
        healthRatio: 1.0,
        lastUpdated: new Date(0),
        location: {
          x: 3223,
          y: 3363,
          plane: 0,
        },
      },
    };
    const timeline = demoData.gary_timeline;
    const index = Math.max(Math.floor(elapsedMS / 600), 0) % timeline.length;
    const WIZARD_ENCOUNTER_TICK = timeline.length - 28;
    const WIZARD_DAMAGE_TICK = timeline.length - 26;
    if (index > WIZARD_ENCOUNTER_TICK) {
      member.interacting.lastUpdated = new Date(Date.now());
    }
    if (index > WIZARD_DAMAGE_TICK) {
      member.stats.health.current = Math.max(0, 10 - Math.floor((index - WIZARD_DAMAGE_TICK) / 4) * 2);
    }
    const [x, y] = timeline.at(index) ?? [0, 0];
    member.coordinates = {
      x,
      y,
      plane: 0,
      isOnBoat: false,
    };
    results.push(member);
  }
  const xXgamerXxRoster = roster.find(({ originalName }) => originalName === "xXgamerXx");
  if (xXgamerXxRoster) {
    const member = {
      ...DEFAULT_MEMBER,
      name: xXgamerXxRoster.displayName,
      bank: banks.get("xXgamerXx"),
      lastUpdated: new Date(Date.now()),
      skills: {
        ...DEFAULT_SKILLS,
      },
      stats: {
        health: {
          current: 99,
          max: 99,
        },
        prayer: {
          current: 99,
          max: 99,
        },
        run: {
          current: 100,
          max: 100,
        },
        world: 329,
        specialAttack: {
          current: 100,
          max: 100,
        },
      },
      quests: MAX_QUEST,
      diaries: MAX_DIARY,
      coordinates: {
        x: 3354,
        y: 9120,
        plane: 0,
        isOnBoat: false,
      },
      quiver: new Map([
        [
          11212,
          {
            itemID: 11212,
            quantity: 24381,
          },
        ],
      ]),
      runePouch: new Map([
        [
          565,
          {
            itemID: 565,
            quantity: 13929392,
          },
        ],
        [
          560,
          {
            itemID: 560,
            quantity: 22381328,
          },
        ],
        [
          554,
          {
            itemID: 554,
            quantity: 34842382,
          },
        ],
        [
          30843,
          {
            itemID: 30843,
            quantity: 22313418,
          },
        ],
      ]),
      equipment: new Map([
        [
          "Cape",
          {
            itemID: 28955,
            quantity: 1,
          },
        ],
        [
          "Head",
          {
            itemID: 27235,
            quantity: 1,
          },
        ],
        [
          "Body",
          {
            itemID: 27238,
            quantity: 1,
          },
        ],
        [
          "Legs",
          {
            itemID: 27241,
            quantity: 1,
          },
        ],
        [
          "Amulet",
          {
            itemID: 19547,
            quantity: 1,
          },
        ],
        [
          "Weapon",
          {
            itemID: 20997,
            quantity: 1,
          },
        ],
        [
          "Ammo",
          {
            itemID: 27544,
            quantity: 1,
          },
        ],
        [
          "Boots",
          {
            itemID: 31097,
            quantity: 1,
          },
        ],
        [
          "Gloves",
          {
            itemID: 26235,
            quantity: 1,
          },
        ],
        [
          "Ring",
          {
            itemID: 28310,
            quantity: 1,
          },
        ],
      ]),
      inventory: new Map(
        [
          {
            itemID: 27275,
            quantity: 1,
          },
          {
            itemID: 24664,
            quantity: 1,
          },
          {
            itemID: 27246,
            quantity: 1,
          },
          {
            itemID: 28254,
            quantity: 1,
          },
          {
            itemID: 12002,
            quantity: 1,
          },
          {
            itemID: 24666,
            quantity: 1,
          },
          {
            itemID: 29804,
            quantity: 1,
          },
          {
            itemID: 28256,
            quantity: 1,
          },
          {
            itemID: 31106,
            quantity: 1,
          },
          {
            itemID: 24668,
            quantity: 1,
          },
          {
            itemID: 22981,
            quantity: 1,
          },
          {
            itemID: 28258,
            quantity: 1,
          },
          {
            itemID: 28313,
            quantity: 1,
          },
          {
            itemID: 21795,
            quantity: 1,
          },
          {
            itemID: 28307,
            quantity: 1,
          },
          {
            itemID: 21297,
            quantity: 1,
          },
          {
            itemID: 27291,
            quantity: 1,
          },
          {
            itemID: 28688,
            quantity: 1,
          },
          {
            itemID: 27610,
            quantity: 1,
          },
          {
            itemID: 22322,
            quantity: 1,
          },
          {
            itemID: 8872,
            quantity: 1,
          },
          {
            itemID: 10925,
            quantity: 1,
          },
          {
            itemID: 10925,
            quantity: 1,
          },
          {
            itemID: 27281,
            quantity: 1,
          },
          {
            itemID: 10925,
            quantity: 1,
          },
          {
            itemID: 10925,
            quantity: 1,
          },
          {
            itemID: 23685,
            quantity: 1,
          },
          {
            itemID: 25818,
            quantity: 1,
          },
        ].map((item, index) => [index, item]),
      ),
    };
    for (const skill of skills) {
      member.skills[skill] = EXPERIENCE_99;
    }
    results.push(member);
  }
  for (const { displayName } of roster.filter(({ originalName }) => originalName === undefined)) {
    results.push({
      ...DEFAULT_MEMBER,
      name: displayName,
    });
  }
  results.push({
    ...DEFAULT_MEMBER,
    name: "@SHARED",
    bank: sharedBank,
  });
  return results;
}
