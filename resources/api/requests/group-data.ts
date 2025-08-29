import z from "zod/v4";
import type { QuestStatus } from "../../game/quests";
import { Skill, type Experience } from "../../game/skill";
import { DiaryTier, type DiaryRegion } from "../../game/diaries";
import { EquipmentSlot } from "../../game/equipment";
import type { ItemID, ItemStack } from "../../game/items";
import type { GroupCredentials } from "../credentials";
import * as Member from "../../game/member";
import { DateSchema } from "./shared";

export type Response = z.infer<typeof GetGroupDataResponseSchema>;

/**
 * Returns a promise that resolves with the instantaneous state of members from the given
 * group, or rejects with a reason if there was some error.
 *
 * @param baseURL Base URL of API, such as https://backend.foo.com/api/
 * @param credentials Group name and token, required for authorization.
 * @param fromTime The time to update from. Timestamped group data that is given
 *  in slices will be given for fromTime until as recent as the server has when
 *  processing the request.
 */
export const fetchGroupData = ({
  baseURL,
  credentials,
  fromTime,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  fromTime: Date;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/get-group-data?from_time=${fromTime.toISOString()}`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("GetGroupData HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => {
      return GetGroupDataResponseSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("GetGroupData response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });

const StatsSchema = z
  .array(z.uint32())
  .length(7)
  .refine((stats) => stats[5] === 100) // Plugin reports max run energy as 100, when it actually is 10000.
  .transform((args) => {
    return {
      health: {
        current: args[0],
        max: args[1],
      },
      prayer: {
        current: args[2],
        max: args[3],
      },
      run: {
        current: args[4],
        max: 10000,
      },
      world: args[6],
    };
  });

/**
 * Backend obeys this order:
 * https://github.com/runelite/runelite/blob/a8bdd510971fc8974959e2c9b34b6b88b46bb0fd/runelite-api/src/main/java/net/runelite/api/EquipmentInventorySlot.java#L37
 * We use the names from runelite source.
 */
const EquipmentSlotInBackendOrder: EquipmentSlot[] = [
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
] as const;
const EquipmentSchema = z
  .array(z.uint32())
  .length(2 * (EquipmentSlot.length - 1)) // Quiver is an equipment slot but comes as a separate `quiver` key
  .transform((equipmentFlat) => {
    return equipmentFlat.reduce<Map<EquipmentSlot, ItemStack>>((equipment, _, index, equipmentFlat) => {
      if (index % 2 !== 0 || index + 1 >= equipmentFlat.length) return equipment;

      const itemID = equipmentFlat[index] as ItemID;
      const quantity = equipmentFlat[index + 1];

      if (quantity < 1) return equipment;

      const slot = EquipmentSlotInBackendOrder[index / 2];
      equipment.set(slot, { itemID, quantity });
      return equipment;
    }, new Map());
  });

const QuiverSchema = z
  .array(z.uint32())
  .refine((arr) => arr.length === 0 || arr.length === 2)
  .transform((flat) => {
    const result = new Map<ItemID, number>();
    if (flat.length === 2) {
      const itemID = flat[0] as ItemID;
      const quantity = flat[1];

      if (quantity > 0) {
        result.set(itemID, quantity);
      }
    }

    return result;
  });

const ItemCollectionSchema = z
  .array(z.uint32().or(z.literal(-1)))
  .refine((arg) => arg.length % 2 === 0)
  .transform((arg: number[]) =>
    arg.reduce<Map<ItemID, number>>((items, _, index, flatItems) => {
      if (index % 2 !== 0 || index + 1 >= flatItems.length) return items;

      const itemID = flatItems[index] as ItemID;

      // -1 seems to be a sentinel for empty rune pouch spots
      if (itemID < 0) return items;

      const itemQuantity = flatItems[index + 1];

      items.set(itemID, itemQuantity + (items.get(itemID) ?? 0));

      return items;
    }, new Map<ItemID, number>()),
  );

const INVENTORY_SIZE = 28;

const InventoryFromBackend = z
  .array(z.uint32())
  .length(2 * INVENTORY_SIZE)
  .transform((flat) =>
    flat.reduce<(ItemStack | undefined)[]>((inventory, _, index, flat) => {
      if (index % 2 !== 0) return inventory;

      const itemID = flat[index] as ItemID;
      const quantity = flat[index + 1];

      if (quantity === 0) inventory.push(undefined);
      else inventory.push({ itemID, quantity });
      return inventory;
    }, []),
  );

/**
 * Skills in the order that the backend sends the flat arrays of experience in.
 */
export const SkillsInBackendOrder: Skill[] = [
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
] as const;
const ExperienceSchema = z.uint32().transform((xp) => xp as Experience);
const SkillsSchema = ExperienceSchema.array()
  .length(SkillsInBackendOrder.length)
  .transform((xpFlat) => {
    const skills: Partial<Record<Skill, Experience>> = {};
    SkillsInBackendOrder.forEach((skill, index) => {
      skills[skill] = xpFlat.at(index);
    });
    return skills as Record<Skill, Experience>;
  });

const QuestStatusInBackendOrder: QuestStatus[] = ["IN_PROGRESS", "NOT_STARTED", "FINISHED"] as const;

/**
 * Quests are sent by the backend without IDs. They are sorted by ascending ID order.
 * Thus, if there is a mismatch in length, it is impossible to tell which quests are missing.
 */
const QuestsSchema = z
  .uint32()
  .refine((progress) => progress === 0 || progress === 1 || progress === 2)
  .transform((progress) => QuestStatusInBackendOrder[progress])
  .array();
const isBitSet = (value: number, offset: number): boolean => {
  return (value & (1 << offset)) !== 0;
};

const NPCInteractionSchema = z
  .object({
    /**
     * Name of the NPC.
     */
    name: z.string(),
    /**
     * Relative size of the NPC's hp bar. It is not the actual HP of the monster.
     * I.e. "max" in "current / max" for a traditional stat bar.
     * See runelite source for comments:
     * https://github.com/runelite/runelite/blob/a8bdd510971fc8974959e2c9b34b6b88b46bb0fd/runelite-api/src/main/java/net/runelite/api/Actor.java#L102
     * This number is 30 for most actors, but larger for other things. -1 when health info does not exist.
     */
    scale: z.uint32().or(z.literal(-1)),
    /**
     * Amount of the NPC's hp bar that is filled.
     * I.e. "current" in "current / max" for a traditional stat bar.
     */
    ratio: z.uint32().or(z.literal(-1)),
    /**
     * Where the NPC is in the world
     */
    location: z.object({ x: z.number(), y: z.number(), plane: z.number() }),
    /**
     * The last time the player reported interacting with the NPC.
     */
    last_updated: DateSchema,
  })
  .refine((interaction) => {
    const noHP = interaction.scale === -1 && interaction.ratio === -1;
    const hasHP = interaction.scale > 0 && interaction.ratio >= 0;
    return noHP || hasHP;
  })
  .transform(({ name, scale, ratio, location, last_updated }) => ({
    name,
    healthRatio: scale > 0 ? ratio / scale : undefined,
    location,
    lastUpdated: new Date(last_updated),
  }));

/**
 * The diaries are stored in a series of 32-bit bitmasks, where different regions/tiers bleed together.
 * I don't think there's an easy way around this, besides storing things differently in the backend.
 * It is unfortunate that we have to hardcode this. For now, the backend sends the data as the raw varbits/varps that OSRS uses.
 */
const DiariesSchema = z
  .int32()
  .array()
  .transform(
    (diaryVars) =>
      ({
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
      }) satisfies Record<DiaryRegion, Record<DiaryTier, boolean[]>>,
  );

const CoordinatesSchema = z
  .uint32()
  .array()
  .length(3)
  .transform(([x, y, plane]) => ({ x, y, plane }));

const GetGroupDataResponseSchema = z
  .object({
    /**
     * The name of the player
     */
    name: z.string().transform((arg) => arg as Member.Name),
    /**
     * Current world coordinates of the player.
     */
    coordinates: CoordinatesSchema.nullish().transform((value) => value ?? undefined),
    /**
     * The last time the player sent an update
     */
    last_updated: DateSchema.nullish().transform((value) => value ?? undefined),
    /**
     * The items in the player's bank.
     * When defined, it always contains all of the items.
     */
    bank: z.nullish(ItemCollectionSchema).transform((value) => value ?? undefined),
    /**
     * The items in the player's equipment.
     * When defined, it always contains all of the items.
     */
    equipment: z.nullish(EquipmentSchema).transform((value) => value ?? undefined),
    /**
     * The items in the player's quiver.
     * When defined, it always contains all of the items (which is always 1 item in case of the quiver).
     */
    quiver: z.nullish(QuiverSchema).transform((value) => value ?? undefined),
    /**
     * The items in the player's inventory.
     * When defined, it always contains all of the items.
     */
    inventory: z.nullish(InventoryFromBackend).transform((value) => value ?? undefined),
    /**
     * The items in the player's rune pouch.
     * When defined, it always contains all of the items.
     */
    rune_pouch: z.nullish(ItemCollectionSchema).transform((value) => value ?? undefined),
    /**
     * The items in the player's farming guild seed vault.
     * When defined, it always contains all of the items.
     */
    seed_vault: z.nullish(ItemCollectionSchema).transform((value) => value ?? undefined),
    /**
     * Information on NPC the player last interacted with.
     */
    interacting: NPCInteractionSchema.nullish().transform((value) => value ?? undefined),
    /**
     * Stats of the player, including the last known world they were on.
     */
    stats: StatsSchema.nullish().transform((value) => value ?? undefined),
    /**
     * Skills of the player, given in XP amount.
     */
    skills: SkillsSchema.nullish().transform((value) => value ?? undefined),
    /**
     * Quest progress/completion status per quest.
     */
    quests: QuestsSchema.nullish().transform((value) => value ?? undefined),
    /**
     * Achievement diary progression
     */
    diary_vars: DiariesSchema.nullish().transform((value) => value ?? undefined),
  })
  .transform(({ last_updated, rune_pouch, seed_vault, diary_vars, quiver, ...rest }) => ({
    lastUpdated: last_updated,
    runePouch: rune_pouch,
    seedVault: seed_vault,
    quiver,
    diaries: diary_vars,
    ...rest,
  }))
  .transform((memberState) => {
    for (const key of Object.keys(memberState)) {
      if (memberState[key as keyof typeof memberState] !== undefined) continue;

      delete memberState[key as keyof typeof memberState];
    }

    return memberState;
  })
  .array();
