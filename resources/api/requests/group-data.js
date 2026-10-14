import diaryTasks from "../../game/diary-tasks.json";
import * as z from "zod/v4";
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
  .length(8)
  .refine(function hasValidRunMaximum(stats) {
    return stats[5] === 100;
  })
  .transform(function mapStats(stats) {
    return {
      health: { current: stats[0], max: stats[1] },
      prayer: { current: stats[2], max: stats[3] },
      run: { current: Math.floor(stats[4] / 100), max: stats[5] },
      world: stats[6],
      specialAttack: { current: stats[7], max: 100 },
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
  return Object.fromEntries(
    Object.entries(diaryTasks).map(function parseRegion([region, tiers]) {
      return [
        region,
        Object.fromEntries(
          Object.entries(tiers).map(function parseTier([tier, tasks]) {
            return [
              tier,
              tasks.map(function taskComplete(task) {
                if (task.value) {
                  return diaryVars[task.value[0]] === task.value[1];
                }
                return task.bits.some(function bitComplete([variable, bit]) {
                  return (diaryVars[variable] & (1 << bit)) !== 0;
                });
              }),
            ];
          }),
        ),
      ];
    }),
  );
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
      id: z.number().int().positive(),
      name: z.string(),
      coordinates: coordinatesSchema.nullish().transform(function omitNull(value) {
        return value ?? undefined;
      }),
      plugin_status: z
        .object({
          reason: z.enum(["wrong_plugin", "update_available"]),
          installed_version: z.string().nullable(),
          latest_version: z.string().nullable(),
        })
        .nullish(),
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
      poh_spice_rack: nullableItemCollectionSchema,
      poh_pet_house: nullableItemCollectionSchema,
      poh_servants_moneybag: nullableItemCollectionSchema,
      plank_sack: nullableItemCollectionSchema,
      master_scroll_book: nullableItemCollectionSchema,
      essence_pouches: nullableItemCollectionSchema,
      tackle_box: nullableItemCollectionSchema,
      tool_leprechaun: nullableItemCollectionSchema,
      elnock_inquisitor: nullableItemCollectionSchema,
      coal_bag: nullableItemCollectionSchema,
      fish_barrel: nullableItemCollectionSchema,
      herb_sack: nullableItemCollectionSchema,
      looting_bag: nullableItemCollectionSchema,
      seed_box: nullableItemCollectionSchema,
      gem_bag: nullableItemCollectionSchema,
      chugging_barrel: nullableItemCollectionSchema,
      stash_units: z
        .nullish(
          z.array(
            z.object({
              id: z.number().int().positive(),
              name: z.string(),
              tier: z.enum(["Beginner", "Easy", "Medium", "Hard", "Elite", "Master"]),
              state: z.enum(["unbuilt", "empty", "filled"]),
              items: itemCollectionSchema,
              alternatives: z.array(z.string()),
            }),
          ),
        )
        .transform(function mapStashUnits(units) {
          return units == null
            ? undefined
            : new Map(
                units.map(function mapUnit(unit) {
                  return [unit.id, unit];
                }),
              );
        }),
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
    }),
  )
  .transform(function mapMembers(members) {
    return members.map(mapMember);
  });

function mapMember({
  last_updated,
  last_online_at,
  plugin_status,
  rune_pouch,
  seed_vault,
  potion_storage,
  poh_costume_room,
  poh_spice_rack,
  poh_pet_house,
  poh_servants_moneybag,
  plank_sack,
  master_scroll_book,
  essence_pouches,
  diary_vars,
  color_hue_degrees,
  tackle_box,
  tool_leprechaun,
  elnock_inquisitor,
  coal_bag,
  fish_barrel,
  herb_sack,
  looting_bag,
  seed_box,
  gem_bag,
  chugging_barrel,
  stash_units,
  ...member
}) {
  const mappedMember = {
    ...member,
    lastUpdated: last_updated,
    lastOnlineAt: last_online_at,
    pluginStatus: plugin_status,
    runePouch: rune_pouch,
    seedVault: seed_vault,
    potionStorage: potion_storage,
    pohCostumeRoom: poh_costume_room,
    pohSpiceRack: poh_spice_rack,
    pohPetHouse: poh_pet_house,
    pohServantsMoneybag: poh_servants_moneybag,
    plankSack: plank_sack,
    masterScrollBook: master_scroll_book,
    essencePouches: essence_pouches,
    diaries: diary_vars,
    colorHueDegrees: color_hue_degrees,
    tackleBox: tackle_box,
    toolLeprechaun: tool_leprechaun,
    elnockInquisitor: elnock_inquisitor,
    coalBag: coal_bag,
    fishBarrel: fish_barrel,
    herbSack: herb_sack,
    lootingBag: looting_bag,
    seedBox: seed_box,
    gemBag: gem_bag,
    chuggingBarrel: chugging_barrel,
    stashUnits: stash_units,
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
