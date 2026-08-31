import * as z from "zod/v4";
import { skills } from "../../game/skill";
import { dateSchema } from "./shared";

export async function fetchGroupData({ baseURL, credentials, fromTime }) {
  const response = await fetch(
    `${baseURL}/group/${credentials.name}/get-group-data?from_time=${fromTime.toISOString()}`,
    {
      headers: {
        Authorization: credentials.token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("GetGroupData HTTP response was not OK");
  }

  return parseGroupData(await response.json());
}

const statsSchema = z
  .array(z.uint32())
  .min(7)
  .max(8)
  .refine(function hasValidRunMaximum(stats) {
    return stats[5] === 100;
  })
  .transform(function mapStats(stats) {
    return {
      health: { current: stats[0], max: stats[1] },
      prayer: { current: stats[2], max: stats[3] },
      run: { current: Math.floor(stats[4] / 100), max: stats[5] },
      world: stats[6],
      specialAttack: { current: stats[7] ?? 100, max: 100 },
    };
  });

function reshapeFlattenedItemArray(flat, keepInvalid) {
  const squeezed = [];
  for (let index = 0; index < Math.floor(flat.length / 2); index++) {
    const itemID = flat[2 * index];
    const quantity = flat[2 * index + 1];
    if (itemID <= 0 || quantity <= 0) {
      if (keepInvalid) {
        squeezed.push(undefined);
      }
      continue;
    } else {
      squeezed.push({
        itemID,
        quantity,
      });
    }
  }
  return squeezed;
}
const EquipmentSlotInBackendOrder = [
  "Head",
  "Cape",
  "Amulet",
  "Weapon",
  "Body",
  "Shield",
  "Arms",
  "Legs",
  "Hair",
  "Gloves",
  "Boots",
  "Jaw",
  "Ring",
  "Ammo",
];
const equipmentSchema = z
  .array(z.uint32())
  .length(2 * EquipmentSlotInBackendOrder.length)
  .transform(function mapEquipment(flat) {
    const equipment = new Map();

    for (const [index, itemStack] of reshapeFlattenedItemArray(flat, true).entries()) {
      if (itemStack) {
        equipment.set(EquipmentSlotInBackendOrder[index], itemStack);
      }
    }

    return equipment;
  });

const itemCollectionSchema = z
  .array(z.uint32().or(z.literal(-1)))
  .refine(function hasItemPairs(flat) {
    return flat.length % 2 === 0;
  })
  .transform(function mapItemCollection(flat) {
    const items = new Map();

    for (const itemStack of reshapeFlattenedItemArray(flat, false)) {
      const quantity = (items.get(itemStack.itemID)?.quantity ?? 0) + itemStack.quantity;
      items.set(itemStack.itemID, { itemID: itemStack.itemID, quantity });
    }

    return items;
  });

const quiverSchema = z
  .array(z.uint32())
  .refine(function hasValidQuiverLength(flat) {
    return flat.length === 0 || flat.length === 2;
  })
  .transform(function mapQuiver(flat) {
    return itemCollectionSchema.parse(flat);
  });

const INVENTORY_SIZE = 28;

const inventorySchema = z
  .array(z.uint32())
  .length(2 * INVENTORY_SIZE)
  .transform(function mapInventory(flat) {
    const inventory = new Map();

    for (const [index, itemStack] of reshapeFlattenedItemArray(flat, true).entries()) {
      if (itemStack) {
        inventory.set(index, itemStack);
      }
    }

    return inventory;
  });

export const skillsInBackendOrder = [
  "Agility",
  "Attack",
  "Construction",
  "Cooking",
  "Crafting",
  "Defence",
  "Farming",
  "Firemaking",
  "Fishing",
  "Fletching",
  "Herblore",
  "Hitpoints",
  "Hunter",
  "Magic",
  "Mining",
  "Prayer",
  "Ranged",
  "Runecraft",
  "Slayer",
  "Smithing",
  "Strength",
  "Thieving",
  "Woodcutting",
  "Sailing",
];
const skillsSchema = z
  .array(z.uint32())
  .length(skillsInBackendOrder.length)
  .transform(function mapSkills(experience) {
    const skillExperience = {};

    skillsInBackendOrder.forEach(function mapSkill(skill, index) {
      skillExperience[skill] = experience.at(index);
    });

    for (const skill of skills) {
      skillExperience[skill] ??= 0;
    }

    return skillExperience;
  });

const QuestStatusInBackendOrder = ["IN_PROGRESS", "NOT_STARTED", "FINISHED"];

const questsSchema = z
  .uint32()
  .refine(function hasValidQuestStatus(progress) {
    return progress <= 2;
  })
  .transform(function mapQuestStatus(progress) {
    return QuestStatusInBackendOrder[progress];
  })
  .array();

function isBitSet(value, offset) {
  return (value & (1 << offset)) !== 0;
}
const interactionSchema = z
  .object({
    name: z.string(),
    scale: z.uint32().or(z.literal(-1)),
    ratio: z.uint32().or(z.literal(-1)),
    location: z.object({ x: z.number(), y: z.number(), plane: z.number() }),
    last_updated: dateSchema,
  })
  .refine(function hasValidHealth({ scale, ratio }) {
    return ratio === -1 || (scale > 0 && ratio >= 0);
  })
  .transform(function mapInteraction({ name, scale, ratio, location, last_updated }) {
    return {
      name,
      healthRatio: scale > 0 && ratio >= 0 ? ratio / scale : undefined,
      location,
      lastUpdated: last_updated,
    };
  });

function parseDiaries(diaryVars) {
  return {
    Ardougne: {
      Easy: [
        isBitSet(diaryVars[0], 0),
        isBitSet(diaryVars[0], 1),
        isBitSet(diaryVars[0], 2),
        isBitSet(diaryVars[0], 4),
        isBitSet(diaryVars[0], 5),
        isBitSet(diaryVars[0], 6),
        isBitSet(diaryVars[0], 7),
        isBitSet(diaryVars[0], 9),
        isBitSet(diaryVars[0], 11),
        isBitSet(diaryVars[0], 12),
      ],
      Medium: [
        isBitSet(diaryVars[0], 13),
        isBitSet(diaryVars[0], 14),
        isBitSet(diaryVars[0], 15),
        isBitSet(diaryVars[0], 16),
        isBitSet(diaryVars[0], 17),
        isBitSet(diaryVars[0], 18),
        isBitSet(diaryVars[0], 19),
        isBitSet(diaryVars[0], 20),
        isBitSet(diaryVars[0], 21),
        isBitSet(diaryVars[0], 23),
        isBitSet(diaryVars[0], 24),
        isBitSet(diaryVars[0], 25),
      ],
      Hard: [
        isBitSet(diaryVars[0], 26),
        isBitSet(diaryVars[0], 27),
        isBitSet(diaryVars[0], 28),
        isBitSet(diaryVars[0], 29),
        isBitSet(diaryVars[0], 30),
        isBitSet(diaryVars[0], 31),
        isBitSet(diaryVars[1], 0),
        isBitSet(diaryVars[1], 1),
        isBitSet(diaryVars[1], 2),
        isBitSet(diaryVars[1], 3),
        isBitSet(diaryVars[1], 4),
        isBitSet(diaryVars[1], 5),
      ],
      Elite: [
        isBitSet(diaryVars[1], 6),
        isBitSet(diaryVars[1], 7),
        isBitSet(diaryVars[1], 9),
        isBitSet(diaryVars[1], 8),
        isBitSet(diaryVars[1], 10),
        isBitSet(diaryVars[1], 11),
        isBitSet(diaryVars[1], 12),
        isBitSet(diaryVars[1], 13),
      ],
    },
    Desert: {
      Easy: [
        isBitSet(diaryVars[2], 1),
        isBitSet(diaryVars[2], 2),
        isBitSet(diaryVars[2], 3),
        isBitSet(diaryVars[2], 4),
        isBitSet(diaryVars[2], 5),
        isBitSet(diaryVars[2], 6),
        isBitSet(diaryVars[2], 7),
        isBitSet(diaryVars[2], 8),
        isBitSet(diaryVars[2], 9),
        isBitSet(diaryVars[2], 10),
        isBitSet(diaryVars[2], 11),
      ],
      Medium: [
        isBitSet(diaryVars[2], 12),
        isBitSet(diaryVars[2], 13),
        isBitSet(diaryVars[2], 14),
        isBitSet(diaryVars[2], 15),
        isBitSet(diaryVars[2], 16),
        isBitSet(diaryVars[2], 17),
        isBitSet(diaryVars[2], 18),
        isBitSet(diaryVars[2], 19),
        isBitSet(diaryVars[2], 20),
        isBitSet(diaryVars[2], 21),
        isBitSet(diaryVars[2], 22) || isBitSet(diaryVars[3], 9),
        isBitSet(diaryVars[2], 23),
      ],
      Hard: [
        isBitSet(diaryVars[2], 24),
        isBitSet(diaryVars[2], 25),
        isBitSet(diaryVars[2], 26),
        isBitSet(diaryVars[2], 27),
        isBitSet(diaryVars[2], 28),
        isBitSet(diaryVars[2], 29),
        isBitSet(diaryVars[2], 30),
        isBitSet(diaryVars[2], 31),
        isBitSet(diaryVars[3], 0),
        isBitSet(diaryVars[3], 1),
      ],
      Elite: [
        isBitSet(diaryVars[3], 2),
        isBitSet(diaryVars[3], 4),
        isBitSet(diaryVars[3], 5),
        isBitSet(diaryVars[3], 6),
        isBitSet(diaryVars[3], 7),
        isBitSet(diaryVars[3], 8),
      ],
    },
    Falador: {
      Easy: [
        isBitSet(diaryVars[4], 0),
        isBitSet(diaryVars[4], 1),
        isBitSet(diaryVars[4], 2),
        isBitSet(diaryVars[4], 3),
        isBitSet(diaryVars[4], 4),
        isBitSet(diaryVars[4], 5),
        isBitSet(diaryVars[4], 6),
        isBitSet(diaryVars[4], 7),
        isBitSet(diaryVars[4], 8),
        isBitSet(diaryVars[4], 9),
        isBitSet(diaryVars[4], 10),
      ],
      Medium: [
        isBitSet(diaryVars[4], 11),
        isBitSet(diaryVars[4], 12),
        isBitSet(diaryVars[4], 13),
        isBitSet(diaryVars[4], 14),
        isBitSet(diaryVars[4], 15),
        isBitSet(diaryVars[4], 16),
        isBitSet(diaryVars[4], 17),
        isBitSet(diaryVars[4], 18),
        isBitSet(diaryVars[4], 20),
        isBitSet(diaryVars[4], 21),
        isBitSet(diaryVars[4], 22),
        isBitSet(diaryVars[4], 23),
        isBitSet(diaryVars[4], 24),
        isBitSet(diaryVars[4], 25),
      ],
      Hard: [
        isBitSet(diaryVars[4], 26),
        isBitSet(diaryVars[4], 27),
        isBitSet(diaryVars[4], 28),
        isBitSet(diaryVars[4], 29),
        isBitSet(diaryVars[4], 30),
        isBitSet(diaryVars[4], 31),
        isBitSet(diaryVars[5], 0),
        isBitSet(diaryVars[5], 1),
        isBitSet(diaryVars[5], 2),
        isBitSet(diaryVars[5], 3),
        isBitSet(diaryVars[5], 4),
      ],
      Elite: [
        isBitSet(diaryVars[5], 5),
        isBitSet(diaryVars[5], 6),
        isBitSet(diaryVars[5], 7),
        isBitSet(diaryVars[5], 8),
        isBitSet(diaryVars[5], 9),
        isBitSet(diaryVars[5], 10),
      ],
    },
    Fremennik: {
      Easy: [
        isBitSet(diaryVars[6], 1),
        isBitSet(diaryVars[6], 2),
        isBitSet(diaryVars[6], 3),
        isBitSet(diaryVars[6], 4),
        isBitSet(diaryVars[6], 5),
        isBitSet(diaryVars[6], 6),
        isBitSet(diaryVars[6], 7),
        isBitSet(diaryVars[6], 8),
        isBitSet(diaryVars[6], 9),
        isBitSet(diaryVars[6], 10),
      ],
      Medium: [
        isBitSet(diaryVars[6], 11),
        isBitSet(diaryVars[6], 12),
        isBitSet(diaryVars[6], 13),
        isBitSet(diaryVars[6], 14),
        isBitSet(diaryVars[6], 15),
        isBitSet(diaryVars[6], 17),
        isBitSet(diaryVars[6], 18),
        isBitSet(diaryVars[6], 19),
        isBitSet(diaryVars[6], 20),
      ],
      Hard: [
        isBitSet(diaryVars[6], 21),
        isBitSet(diaryVars[6], 23),
        isBitSet(diaryVars[6], 24),
        isBitSet(diaryVars[6], 25),
        isBitSet(diaryVars[6], 26),
        isBitSet(diaryVars[6], 27),
        isBitSet(diaryVars[6], 28),
        isBitSet(diaryVars[6], 29),
        isBitSet(diaryVars[6], 30),
      ],
      Elite: [
        isBitSet(diaryVars[6], 31),
        isBitSet(diaryVars[7], 0),
        isBitSet(diaryVars[7], 1),
        isBitSet(diaryVars[7], 2),
        isBitSet(diaryVars[7], 3),
        isBitSet(diaryVars[7], 4),
      ],
    },
    Kandarin: {
      Easy: [
        isBitSet(diaryVars[8], 1),
        isBitSet(diaryVars[8], 2),
        isBitSet(diaryVars[8], 3),
        isBitSet(diaryVars[8], 4),
        isBitSet(diaryVars[8], 5),
        isBitSet(diaryVars[8], 6),
        isBitSet(diaryVars[8], 7),
        isBitSet(diaryVars[8], 8),
        isBitSet(diaryVars[8], 9),
        isBitSet(diaryVars[8], 10),
        isBitSet(diaryVars[8], 11),
      ],
      Medium: [
        isBitSet(diaryVars[8], 12),
        isBitSet(diaryVars[8], 13),
        isBitSet(diaryVars[8], 14),
        isBitSet(diaryVars[8], 15),
        isBitSet(diaryVars[8], 16),
        isBitSet(diaryVars[8], 17),
        isBitSet(diaryVars[8], 18),
        isBitSet(diaryVars[8], 19),
        isBitSet(diaryVars[8], 20),
        isBitSet(diaryVars[8], 21),
        isBitSet(diaryVars[8], 22),
        isBitSet(diaryVars[8], 23),
        isBitSet(diaryVars[8], 24),
        isBitSet(diaryVars[8], 25),
      ],
      Hard: [
        isBitSet(diaryVars[8], 26),
        isBitSet(diaryVars[8], 27),
        isBitSet(diaryVars[8], 28),
        isBitSet(diaryVars[8], 29),
        isBitSet(diaryVars[8], 30),
        isBitSet(diaryVars[8], 31),
        isBitSet(diaryVars[9], 0),
        isBitSet(diaryVars[9], 1),
        isBitSet(diaryVars[9], 2),
        isBitSet(diaryVars[9], 3),
        isBitSet(diaryVars[9], 4),
      ],
      Elite: [
        isBitSet(diaryVars[9], 5),
        isBitSet(diaryVars[9], 6),
        isBitSet(diaryVars[9], 7),
        isBitSet(diaryVars[9], 8),
        isBitSet(diaryVars[9], 9),
        isBitSet(diaryVars[9], 10),
        isBitSet(diaryVars[9], 11),
      ],
    },
    Karamja: {
      Easy: [
        diaryVars[23] === 5,
        diaryVars[24] === 1,
        diaryVars[25] === 1,
        diaryVars[26] === 1,
        diaryVars[27] === 1,
        diaryVars[28] === 1,
        diaryVars[29] === 1,
        diaryVars[30] === 5,
        diaryVars[31] === 1,
        diaryVars[32] === 1,
      ],
      Medium: [
        diaryVars[33] === 1,
        diaryVars[34] === 1,
        diaryVars[35] === 1,
        diaryVars[36] === 1,
        diaryVars[37] === 1,
        diaryVars[38] === 1,
        diaryVars[39] === 1,
        diaryVars[40] === 1,
        diaryVars[41] === 1,
        diaryVars[42] === 1,
        diaryVars[43] === 1,
        diaryVars[44] === 1,
        diaryVars[45] === 1,
        diaryVars[46] === 1,
        diaryVars[47] === 1,
        diaryVars[48] === 1,
        diaryVars[49] === 1,
        diaryVars[50] === 1,
        diaryVars[51] === 1,
      ],
      Hard: [
        diaryVars[52] === 1,
        diaryVars[53] === 1,
        diaryVars[54] === 1,
        diaryVars[55] === 1,
        diaryVars[56] === 1,
        diaryVars[57] === 1,
        diaryVars[58] === 1,
        diaryVars[59] === 5,
        diaryVars[60] === 1,
        diaryVars[61] === 1,
      ],
      Elite: [
        isBitSet(diaryVars[10], 1),
        isBitSet(diaryVars[10], 2),
        isBitSet(diaryVars[10], 3),
        isBitSet(diaryVars[10], 4),
        isBitSet(diaryVars[10], 5),
      ],
    },
    "Kourend & Kebos": {
      Easy: [
        isBitSet(diaryVars[11], 1),
        isBitSet(diaryVars[11], 2),
        isBitSet(diaryVars[11], 3),
        isBitSet(diaryVars[11], 4),
        isBitSet(diaryVars[11], 5),
        isBitSet(diaryVars[11], 6),
        isBitSet(diaryVars[11], 7),
        isBitSet(diaryVars[11], 8),
        isBitSet(diaryVars[11], 9),
        isBitSet(diaryVars[11], 10),
        isBitSet(diaryVars[11], 11),
        isBitSet(diaryVars[11], 12),
      ],
      Medium: [
        isBitSet(diaryVars[11], 25),
        isBitSet(diaryVars[11], 13),
        isBitSet(diaryVars[11], 14),
        isBitSet(diaryVars[11], 15),
        isBitSet(diaryVars[11], 21),
        isBitSet(diaryVars[11], 16),
        isBitSet(diaryVars[11], 17),
        isBitSet(diaryVars[11], 18),
        isBitSet(diaryVars[11], 19),
        isBitSet(diaryVars[11], 22),
        isBitSet(diaryVars[11], 20),
        isBitSet(diaryVars[11], 23),
        isBitSet(diaryVars[11], 24),
      ],
      Hard: [
        isBitSet(diaryVars[11], 26),
        isBitSet(diaryVars[11], 27),
        isBitSet(diaryVars[11], 28),
        isBitSet(diaryVars[11], 29),
        isBitSet(diaryVars[11], 31),
        isBitSet(diaryVars[11], 30),
        isBitSet(diaryVars[12], 0),
        isBitSet(diaryVars[12], 1),
        isBitSet(diaryVars[12], 2),
        isBitSet(diaryVars[12], 3),
      ],
      Elite: [
        isBitSet(diaryVars[12], 4),
        isBitSet(diaryVars[12], 5),
        isBitSet(diaryVars[12], 6),
        isBitSet(diaryVars[12], 7),
        isBitSet(diaryVars[12], 8),
        isBitSet(diaryVars[12], 9),
        isBitSet(diaryVars[12], 10),
        isBitSet(diaryVars[12], 11),
      ],
    },
    "Lumbridge & Draynor": {
      Easy: [
        isBitSet(diaryVars[13], 1),
        isBitSet(diaryVars[13], 2),
        isBitSet(diaryVars[13], 3),
        isBitSet(diaryVars[13], 4),
        isBitSet(diaryVars[13], 5),
        isBitSet(diaryVars[13], 6),
        isBitSet(diaryVars[13], 7),
        isBitSet(diaryVars[13], 8),
        isBitSet(diaryVars[13], 9),
        isBitSet(diaryVars[13], 10),
        isBitSet(diaryVars[13], 11),
        isBitSet(diaryVars[13], 12),
      ],
      Medium: [
        isBitSet(diaryVars[13], 13),
        isBitSet(diaryVars[13], 14),
        isBitSet(diaryVars[13], 15),
        isBitSet(diaryVars[13], 16),
        isBitSet(diaryVars[13], 17),
        isBitSet(diaryVars[13], 18),
        isBitSet(diaryVars[13], 19),
        isBitSet(diaryVars[13], 20),
        isBitSet(diaryVars[13], 21),
        isBitSet(diaryVars[13], 22),
        isBitSet(diaryVars[13], 23),
        isBitSet(diaryVars[13], 24),
      ],
      Hard: [
        isBitSet(diaryVars[13], 25),
        isBitSet(diaryVars[13], 26),
        isBitSet(diaryVars[13], 27),
        isBitSet(diaryVars[13], 28),
        isBitSet(diaryVars[13], 29),
        isBitSet(diaryVars[13], 30),
        isBitSet(diaryVars[13], 31),
        isBitSet(diaryVars[14], 0),
        isBitSet(diaryVars[14], 1),
        isBitSet(diaryVars[14], 2),
        isBitSet(diaryVars[14], 3),
      ],
      Elite: [
        isBitSet(diaryVars[14], 4),
        isBitSet(diaryVars[14], 5),
        isBitSet(diaryVars[14], 6),
        isBitSet(diaryVars[14], 7),
        isBitSet(diaryVars[14], 8),
        isBitSet(diaryVars[14], 9),
      ],
    },
    Morytania: {
      Easy: [
        isBitSet(diaryVars[15], 1),
        isBitSet(diaryVars[15], 2),
        isBitSet(diaryVars[15], 3),
        isBitSet(diaryVars[15], 4),
        isBitSet(diaryVars[15], 5),
        isBitSet(diaryVars[15], 6),
        isBitSet(diaryVars[15], 7),
        isBitSet(diaryVars[15], 8),
        isBitSet(diaryVars[15], 9),
        isBitSet(diaryVars[15], 10),
        isBitSet(diaryVars[15], 11),
      ],
      Medium: [
        isBitSet(diaryVars[15], 12),
        isBitSet(diaryVars[15], 13),
        isBitSet(diaryVars[15], 14),
        isBitSet(diaryVars[15], 15),
        isBitSet(diaryVars[15], 16),
        isBitSet(diaryVars[15], 17),
        isBitSet(diaryVars[15], 18),
        isBitSet(diaryVars[15], 19),
        isBitSet(diaryVars[15], 20),
        isBitSet(diaryVars[15], 21),
        isBitSet(diaryVars[15], 22),
      ],
      Hard: [
        isBitSet(diaryVars[15], 23),
        isBitSet(diaryVars[15], 24),
        isBitSet(diaryVars[15], 25),
        isBitSet(diaryVars[15], 26),
        isBitSet(diaryVars[15], 27),
        isBitSet(diaryVars[15], 28),
        isBitSet(diaryVars[15], 29),
        isBitSet(diaryVars[15], 30),
        isBitSet(diaryVars[16], 1),
        isBitSet(diaryVars[16], 2),
      ],
      Elite: [
        isBitSet(diaryVars[16], 3),
        isBitSet(diaryVars[16], 4),
        isBitSet(diaryVars[16], 5),
        isBitSet(diaryVars[16], 6),
        isBitSet(diaryVars[16], 7),
        isBitSet(diaryVars[16], 8),
      ],
    },
    Varrock: {
      Easy: [
        isBitSet(diaryVars[17], 1),
        isBitSet(diaryVars[17], 2),
        isBitSet(diaryVars[17], 3),
        isBitSet(diaryVars[17], 4),
        isBitSet(diaryVars[17], 5),
        isBitSet(diaryVars[17], 6),
        isBitSet(diaryVars[17], 7),
        isBitSet(diaryVars[17], 8),
        isBitSet(diaryVars[17], 9),
        isBitSet(diaryVars[17], 10),
        isBitSet(diaryVars[17], 11),
        isBitSet(diaryVars[17], 12),
        isBitSet(diaryVars[17], 13),
        isBitSet(diaryVars[17], 14),
      ],
      Medium: [
        isBitSet(diaryVars[17], 15),
        isBitSet(diaryVars[17], 16),
        isBitSet(diaryVars[17], 18),
        isBitSet(diaryVars[17], 19),
        isBitSet(diaryVars[17], 20),
        isBitSet(diaryVars[17], 21),
        isBitSet(diaryVars[17], 22),
        isBitSet(diaryVars[17], 23),
        isBitSet(diaryVars[17], 24),
        isBitSet(diaryVars[17], 25),
        isBitSet(diaryVars[17], 26),
        isBitSet(diaryVars[17], 27),
        isBitSet(diaryVars[17], 28),
      ],
      Hard: [
        isBitSet(diaryVars[17], 29),
        isBitSet(diaryVars[17], 30),
        isBitSet(diaryVars[17], 31),
        isBitSet(diaryVars[18], 0),
        isBitSet(diaryVars[18], 1),
        isBitSet(diaryVars[18], 2),
        isBitSet(diaryVars[18], 3),
        isBitSet(diaryVars[18], 4),
        isBitSet(diaryVars[18], 5),
        isBitSet(diaryVars[18], 6),
      ],
      Elite: [
        isBitSet(diaryVars[18], 7),
        isBitSet(diaryVars[18], 8),
        isBitSet(diaryVars[18], 9),
        isBitSet(diaryVars[18], 10),
        isBitSet(diaryVars[18], 11),
      ],
    },
    "Western Provinces": {
      Easy: [
        isBitSet(diaryVars[19], 1),
        isBitSet(diaryVars[19], 2),
        isBitSet(diaryVars[19], 3),
        isBitSet(diaryVars[19], 4),
        isBitSet(diaryVars[19], 5),
        isBitSet(diaryVars[19], 6),
        isBitSet(diaryVars[19], 7),
        isBitSet(diaryVars[19], 8),
        isBitSet(diaryVars[19], 9),
        isBitSet(diaryVars[19], 10),
        isBitSet(diaryVars[19], 11),
      ],
      Medium: [
        isBitSet(diaryVars[19], 12),
        isBitSet(diaryVars[19], 13),
        isBitSet(diaryVars[19], 14),
        isBitSet(diaryVars[19], 15),
        isBitSet(diaryVars[19], 16),
        isBitSet(diaryVars[19], 17),
        isBitSet(diaryVars[19], 18),
        isBitSet(diaryVars[19], 19),
        isBitSet(diaryVars[19], 20),
        isBitSet(diaryVars[19], 21),
        isBitSet(diaryVars[19], 22),
        isBitSet(diaryVars[19], 23),
        isBitSet(diaryVars[19], 24),
      ],
      Hard: [
        isBitSet(diaryVars[19], 25),
        isBitSet(diaryVars[19], 26),
        isBitSet(diaryVars[19], 27),
        isBitSet(diaryVars[19], 28),
        isBitSet(diaryVars[19], 29),
        isBitSet(diaryVars[19], 30),
        isBitSet(diaryVars[19], 31),
        isBitSet(diaryVars[20], 0),
        isBitSet(diaryVars[20], 1),
        isBitSet(diaryVars[20], 2),
        isBitSet(diaryVars[20], 3),
        isBitSet(diaryVars[20], 4),
        isBitSet(diaryVars[20], 5),
      ],
      Elite: [
        isBitSet(diaryVars[20], 6),
        isBitSet(diaryVars[20], 7),
        isBitSet(diaryVars[20], 8),
        isBitSet(diaryVars[20], 9),
        isBitSet(diaryVars[20], 12),
        isBitSet(diaryVars[20], 13),
        isBitSet(diaryVars[20], 14),
      ],
    },
    Wilderness: {
      Easy: [
        isBitSet(diaryVars[21], 1),
        isBitSet(diaryVars[21], 2),
        isBitSet(diaryVars[21], 3),
        isBitSet(diaryVars[21], 4),
        isBitSet(diaryVars[21], 5),
        isBitSet(diaryVars[21], 6),
        isBitSet(diaryVars[21], 7),
        isBitSet(diaryVars[21], 8),
        isBitSet(diaryVars[21], 9),
        isBitSet(diaryVars[21], 10),
        isBitSet(diaryVars[21], 11),
        isBitSet(diaryVars[21], 12),
      ],
      Medium: [
        isBitSet(diaryVars[21], 13),
        isBitSet(diaryVars[21], 14),
        isBitSet(diaryVars[21], 15),
        isBitSet(diaryVars[21], 16),
        isBitSet(diaryVars[21], 18),
        isBitSet(diaryVars[21], 19),
        isBitSet(diaryVars[21], 20),
        isBitSet(diaryVars[21], 21),
        isBitSet(diaryVars[21], 22),
        isBitSet(diaryVars[21], 23),
        isBitSet(diaryVars[21], 24),
      ],
      Hard: [
        isBitSet(diaryVars[21], 25),
        isBitSet(diaryVars[21], 26),
        isBitSet(diaryVars[21], 27),
        isBitSet(diaryVars[21], 28),
        isBitSet(diaryVars[21], 29),
        isBitSet(diaryVars[21], 30),
        isBitSet(diaryVars[21], 31),
        isBitSet(diaryVars[22], 0),
        isBitSet(diaryVars[22], 1),
        isBitSet(diaryVars[22], 2),
      ],
      Elite: [
        isBitSet(diaryVars[22], 3),
        isBitSet(diaryVars[22], 5),
        isBitSet(diaryVars[22], 7),
        isBitSet(diaryVars[22], 8),
        isBitSet(diaryVars[22], 9),
        isBitSet(diaryVars[22], 10),
        isBitSet(diaryVars[22], 11),
      ],
    },
  };
}

export const diariesSchema = z.array(z.int32()).transform(parseDiaries);

const coordinatesSchema = z
  .array(z.uint32())
  .length(4)
  .transform(function mapCoordinates([x, y, plane, isOnBoat]) {
    return { x, y, plane, isOnBoat: isOnBoat === 1 };
  });
const nullableItemCollectionSchema = z.nullish(itemCollectionSchema).transform(function omitNull(value) {
  return value ?? undefined;
});
const groupDataSchema = z
  .array(
    z.object({
      name: z.string(),
      coordinates: coordinatesSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      last_updated: dateSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      last_online_at: dateSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      timezone: z
        .string()
        .nullish()
        .transform(function omitNull(value) {
          return value ?? undefined;
        }),
      bank: nullableItemCollectionSchema,
      equipment: z.nullish(equipmentSchema).transform(function omitNull(value) {
        return value ?? undefined;
      }),
      quiver: z.nullish(quiverSchema).transform(function omitNull(value) {
        return value ?? undefined;
      }),
      inventory: z.nullish(inventorySchema).transform(function omitNull(value) {
        return value ?? undefined;
      }),
      rune_pouch: nullableItemCollectionSchema,
      seed_vault: nullableItemCollectionSchema,
      potion_storage: nullableItemCollectionSchema,
      poh_costume_room: nullableItemCollectionSchema,
      plank_sack: nullableItemCollectionSchema,
      master_scroll_book: nullableItemCollectionSchema,
      essence_pouches: nullableItemCollectionSchema,
      tackle_box: nullableItemCollectionSchema,
      tool_leprechaun: nullableItemCollectionSchema,
      elnock_inquisitor: nullableItemCollectionSchema,
      coal_bag: nullableItemCollectionSchema,
      fish_barrel: nullableItemCollectionSchema,
      interacting: interactionSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      stats: statsSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      skills: skillsSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      quests: questsSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      diary_vars: diariesSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      color_hue_degrees: z
        .number()
        .int()
        .nullish()
        .transform(function omitNull(value) {
          return value ?? undefined;
        }),
      chat_relay_enabled: z.boolean().optional(),
    }),
  )
  .transform(function mapMembers(members) {
    return members.map(mapMember);
  });

function mapMember({
  last_updated,
  last_online_at,
  rune_pouch,
  seed_vault,
  potion_storage,
  poh_costume_room,
  plank_sack,
  master_scroll_book,
  essence_pouches,
  diary_vars,
  color_hue_degrees,
  chat_relay_enabled,
  tackle_box,
  tool_leprechaun,
  elnock_inquisitor,
  coal_bag,
  fish_barrel,
  ...member
}) {
  const mappedMember = {
    ...member,
    lastUpdated: last_updated,
    lastOnlineAt: last_online_at,
    runePouch: rune_pouch,
    seedVault: seed_vault,
    potionStorage: potion_storage,
    pohCostumeRoom: poh_costume_room,
    plankSack: plank_sack,
    masterScrollBook: master_scroll_book,
    essencePouches: essence_pouches,
    diaries: diary_vars,
    colorHueDegrees: color_hue_degrees,
    chatRelayEnabled: chat_relay_enabled,
    tackleBox: tackle_box,
    toolLeprechaun: tool_leprechaun,
    elnockInquisitor: elnock_inquisitor,
    coalBag: coal_bag,
    fishBarrel: fish_barrel,
  };

  for (const key of Object.keys(mappedMember)) {
    if (mappedMember[key] === undefined) {
      delete mappedMember[key];
    }
  }

  return mappedMember;
}

export function parseGroupData(groupData) {
  const parseResult = groupDataSchema.safeParse(groupData);

  if (!parseResult.success) {
    throw new Error("GetGroupData response payload was malformed.", { cause: parseResult.error });
  }

  return parseResult.data;
}
