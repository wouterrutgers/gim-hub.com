import { skills } from "../../game/skill";
import {
  ARCHIVE_MELEE_EQUIPMENT,
  ARCHIVE_RANGED_EQUIPMENT,
  DEFAULT_MEMBER,
  DEFAULT_SKILLS,
  EXPERIENCE_80,
  EXPERIENCE_90,
  EXPERIENCE_99,
  HOSIDIUS_KITCHEN_ROUTE,
  MAX_DIARY,
  MAX_QUEST,
  UNDEAD_COW_LOCATIONS,
} from "./fixtures";

export function mockGroupDataResponse({ roster, cowKiller, banks, sharedBank }, startMS, demoData) {
  const results = [];
  startMS ??= performance.now();
  const tick = Math.floor((performance.now() - startMS) / 600);
  const lastOnlineAt = new Date(Date.now());
  const thurgoRoster = roster.find(({ originalName }) => originalName === "Thurgo");

  if (thurgoRoster) {
    const cookingTick = tick % 128;
    const inventoriesBanked = Math.floor(tick / 128) + (cookingTick >= 120 ? 1 : 0);
    const piesCookedInInventory = cookingTick >= 120 ? 0 : Math.min(28, Math.floor(cookingTick / 4));
    const walkingStep = cookingTick < 122 ? Math.max(0, Math.min(6, cookingTick - 112)) : 128 - cookingTick;
    const [x, y] = HOSIDIUS_KITCHEN_ROUTE[walkingStep];
    const member = {
      ...DEFAULT_MEMBER,
      name: thurgoRoster.displayName,
      lastOnlineAt,
      bank: banks.get("Thurgo"),
      diaries: {
        "Kourend & Kebos": { Easy: MAX_DIARY["Kourend & Kebos"].Easy },
      },
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
      coordinates: {
        x,
        y,
        plane: 0,
        isOnBoat: false,
      },
    };
    member.lastUpdated = new Date(Date.now());

    const REDBERRY_PIE_COOKED = 2325;
    const REDBERRY_PIE_UNCOOKED = 2321;
    member.bank = new Map([
      [
        REDBERRY_PIE_UNCOOKED,
        {
          itemID: REDBERRY_PIE_UNCOOKED,
          quantity: 423425 - inventoriesBanked * 28,
        },
      ],
      [
        REDBERRY_PIE_COOKED,
        {
          itemID: REDBERRY_PIE_COOKED,
          quantity: inventoriesBanked * 28,
        },
      ],
    ]);
    member.skills = {
      ...DEFAULT_SKILLS,
      Cooking: 61512 + (inventoriesBanked * 28 + piesCookedInInventory) * 78,
    };
    member.inventory = new Map();
    let slot = 0;

    for (let i = 0; i < piesCookedInInventory; i++) {
      member.inventory.set(slot++, {
        itemID: REDBERRY_PIE_COOKED,
        quantity: 1,
      });
    }

    for (let i = 0; i < 28 - piesCookedInInventory; i++) {
      member.inventory.set(slot++, {
        itemID: REDBERRY_PIE_UNCOOKED,
        quantity: 1,
      });
    }

    results.push(member);
  }

  const cow31337KillerRoster = roster.find(({ originalName }) => originalName === "Cow31337Killer");

  if (cow31337KillerRoster) {
    const cowTick = tick % 12;
    const cowIndex = Math.floor(tick / 12) % UNDEAD_COW_LOCATIONS.length;
    const [cowX, cowY] = UNDEAD_COW_LOCATIONS[cowIndex];
    const [nextCowX, nextCowY] = UNDEAD_COW_LOCATIONS[(cowIndex + 1) % UNDEAD_COW_LOCATIONS.length];
    const walkingSteps = Math.max(0, cowTick - 8);
    const damageDone = Math.floor((tick + 9) / 12) * 8;
    const member = {
      ...DEFAULT_MEMBER,
      name: cow31337KillerRoster.displayName,
      lastOnlineAt,
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
        x: cowX - 1 + Math.sign(nextCowX - cowX) * walkingSteps,
        y: cowY + Math.sign(nextCowY - cowY) * walkingSteps,
        plane: 0,
        isOnBoat: false,
      },
      lastUpdated: new Date(Date.now()),
    };

    member.skills = {
      ...member.skills,
      Attack: EXPERIENCE_99,
      Defence: EXPERIENCE_99,
      Prayer: EXPERIENCE_80,
      Strength: EXPERIENCE_99 + 4 * damageDone,
      Hitpoints: Math.floor(EXPERIENCE_90 + (4 / 3) * damageDone),
    };
    member.interacting =
      cowTick < 6
        ? {
            name: "Undead cow",
            healthRatio: cowTick < 3 ? 1 : 0,
            location: { x: cowX, y: cowY, plane: 0 },
            lastUpdated: new Date(Date.now()),
          }
        : null;
    results.push(member);
  }

  const garyRoster = roster.find(({ originalName }) => originalName === "Gary");

  if (garyRoster) {
    const member = {
      ...DEFAULT_MEMBER,
      name: garyRoster.displayName,
      lastOnlineAt,
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
      interacting: null,
    };
    const timeline = demoData.gary_timeline;
    const index = tick % timeline.length;
    const WIZARD_ENCOUNTER_TICK = timeline.length - 28;
    const WIZARD_DAMAGE_TICK = timeline.length - 26;

    if (index > WIZARD_ENCOUNTER_TICK && index < timeline.length - 10) {
      member.interacting = {
        name: "Dark wizard",
        healthRatio: 1,
        lastUpdated: new Date(Date.now()),
        location: { x: 3223, y: 3363, plane: 0 },
      };
    }

    if (index > WIZARD_DAMAGE_TICK) {
      member.stats.health.current = Math.max(0, 10 - Math.floor((index - WIZARD_DAMAGE_TICK) / 4) * 2);
    }

    const [x, y] = timeline[index];
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
    const fightTick = tick % 180;
    const completedEncounters = Math.floor(tick / 180);
    const shieldHits = Math.min(13, Math.floor(fightTick / 6));
    const meleeHits = Math.max(0, Math.min(16, Math.floor((fightTick - 85) / 5)));
    const rangedDamage = (completedEncounters * 13 + shieldHits) * 40;
    const meleeDamage = (completedEncounters * 16 + meleeHits) * 60;
    const ranged = fightTick < 80 || fightTick >= 170;
    const suppliesTick = fightTick < 170 ? Math.min(fightTick, 165) : 0;
    const equipment = new Map(
      (ranged ? ARCHIVE_RANGED_EQUIPMENT : ARCHIVE_MELEE_EQUIPMENT).map(function equipItem([slot, itemID]) {
        return [slot, { itemID, quantity: 1 }];
      }),
    );
    const inventoryItems = [
      ...(ranged ? ARCHIVE_MELEE_EQUIPMENT : ARCHIVE_RANGED_EQUIPMENT)
        .filter(function isGearSwitch([slot, itemID]) {
          return equipment.get(slot).itemID !== itemID;
        })
        .map(function getItemIdentifier([, itemID]) {
          return itemID;
        }),
      27281,
      23685,
      23733,
      3024 + Math.floor(suppliesTick / 60) * 2,
      3024,
      6685,
      6685,
      391,
      ...new Array(12).fill(391),
    ];
    let x = 4127;
    let y = 5597;

    if (fightTick < 80) {
      x = 4123 + Math.abs(4 - Math.floor((fightTick % 16) / 2));
      y = 5591;
    }

    if (fightTick >= 80 && fightTick < 86) {
      y = 5592 + fightTick - 80;
    }

    if (fightTick >= 86 && fightTick < 166) {
      x = 4126 + Math.floor(((fightTick - 86) % 12) / 4);
    }

    if (fightTick >= 170) {
      y = 5597 - Math.min(6, fightTick - 169);
    }

    const member = {
      ...DEFAULT_MEMBER,
      name: xXgamerXxRoster.displayName,
      lastOnlineAt,
      bank: banks.get("xXgamerXx"),
      lastUpdated: new Date(Date.now()),
      skills: { ...DEFAULT_SKILLS },
      stats: {
        health: {
          current: 99 - Math.floor((suppliesTick % 36) / 6) * 4,
          max: 99,
        },
        prayer: {
          current: 99 - Math.floor((suppliesTick % 60) / 3),
          max: 99,
        },
        run: {
          current: 100 - Math.floor(suppliesTick / 12),
          max: 100,
        },
        world: 329,
        specialAttack: { current: 100, max: 100 },
      },
      quests: MAX_QUEST,
      diaries: MAX_DIARY,
      coordinates: { x, y, plane: 0, isOnBoat: false },
      quiver: new Map([[33595, { itemID: 33595, quantity: fightTick < 170 ? 500 - shieldHits : 500 }]]),
      runePouch: new Map(
        [555, 560, 565, 566].map(function storeRune(itemID) {
          return [itemID, { itemID, quantity: 2000 }];
        }),
      ),
      equipment,
      inventory: new Map(
        inventoryItems
          .map(function inventorySlot(itemID, index) {
            return [index, { itemID, quantity: 1 }];
          })
          .filter(function uneatenFood([index]) {
            return index < 16 || index >= 16 + Math.floor(suppliesTick / 36);
          }),
      ),
      interacting:
        fightTick < 170
          ? {
              name: "Archive Guardian",
              healthRatio: fightTick < 80 ? 1 - shieldHits / 13 : 1 - meleeHits / 16,
              location: { x: 4126, y: 5598, plane: 0 },
              lastUpdated: new Date(Date.now()),
            }
          : null,
    };

    for (const skill of skills) {
      member.skills[skill] = EXPERIENCE_99;
    }

    member.skills.Ranged += rangedDamage * 4;
    member.skills.Strength += meleeDamage * 4;
    member.skills.Hitpoints += Math.floor(((rangedDamage + meleeDamage) * 4) / 3);
    results.push(member);
  }

  for (const { displayName } of roster.filter(({ originalName }) => originalName === undefined)) {
    results.push({
      ...DEFAULT_MEMBER,
      name: displayName,
      lastOnlineAt,
    });
  }

  return [
    ...roster.map(function getMember({ id, displayName, colorHueDegrees, combatAchievements }) {
      return {
        ...results.find(function matchesMember(member) {
          return member.name === displayName;
        }),
        id,
        colorHueDegrees,
        combatAchievements,
      };
    }),
    { ...DEFAULT_MEMBER, id: 5, name: "@SHARED", bank: sharedBank },
  ];
}
