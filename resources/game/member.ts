import type { Distinct } from "../ts/util";
import type { DiaryRegion, DiaryTier } from "./diaries";
import type { EquipmentSlot } from "./equipment";
import { type ItemID, type ItemStack } from "./items";
import type { QuestID, QuestStatus } from "./quests";
import type { Experience, Skill } from "./skill";
import type { WikiPosition2D } from "../components/canvas-map/coordinates";

export type Name = Distinct<string, "Member.Name">;

const mapToItems = (data: Map<unknown, ItemStack>): Iterable<ItemStack> => data.values();

export const AllItemContainers = [
  { name: "Bank", key: "bank", getItems: mapToItems },
  { name: "Equipment", key: "equipment", getItems: mapToItems },
  { name: "Quiver", key: "quiver", getItems: mapToItems },
  { name: "Inventory", key: "inventory", getItems: mapToItems },
  { name: "Rune Pouch", key: "runePouch", getItems: mapToItems },
  { name: "Seed Vault", key: "seedVault", getItems: mapToItems },
  { name: "Potion Storage", key: "potionStorage", getItems: mapToItems },
  { name: "Costume Room", key: "pohCostumeRoom", getItems: mapToItems },
  { name: "Plank Sack", key: "plankSack", getItems: mapToItems },
  { name: "Master Scroll Book", key: "masterScrollBook", getItems: mapToItems },
  { name: "Essence Pouches", key: "essencePouches", getItems: mapToItems },
  { name: "Tackle Box", key: "tackleBox", getItems: mapToItems },
  { name: "Coal Bag", key: "coalBag", getItems: mapToItems },
  { name: "Fish Barrel", key: "fishBarrel", getItems: mapToItems },
] as const;

export type ItemContainerKey = (typeof AllItemContainers)[number]["key"];
export const ItemContainerKey: readonly ItemContainerKey[] = AllItemContainers.map(({ key }) => key);

export type ItemContainer = (typeof AllItemContainers)[number]["name"];
export const ItemContainer: readonly ItemContainer[] = AllItemContainers.map(({ name }) => name);

export type ItemLocationBreakdown = Partial<Record<ItemContainer, number>>;

export interface State {
  lastUpdated: Date;
  bank: ItemCollection;
  equipment: Equipment;
  quiver: ItemCollection;
  inventory: Inventory;
  runePouch: ItemCollection;
  seedVault: ItemCollection;
  potionStorage: ItemCollection;
  pohCostumeRoom: ItemCollection;
  plankSack: ItemCollection;
  masterScrollBook: ItemCollection;
  essencePouches: ItemCollection;
  tackleBox: ItemCollection;
  coalBag: ItemCollection;
  fishBarrel: ItemCollection;
  coordinates?: { coords: WikiPosition2D; plane: number; isOnBoat: boolean };
  interacting?: NPCInteraction;
  stats?: Stats;
  skills?: Skills;
  quests?: Quests;
  diaries?: Diaries;
  collection?: Collection;
}

export interface Position {
  coords: WikiPosition2D;
  plane: number;
  isOnBoat: boolean;
}
export type ItemCollection = Map<ItemID, ItemStack>;
export type Equipment = Map<EquipmentSlot, ItemStack>;
export type Inventory = Map<number, ItemStack>;
export type Skills = Record<Skill, Experience>;
export type Quests = Map<QuestID, QuestStatus>;
export type Diaries = Record<DiaryRegion, Record<DiaryTier, boolean[]>>;
export type Collection = Map<ItemID, number>;

/**
 * An instance of a member gaining experience, across multiple skills at the
 * same time.
 */
export interface ExperienceDrop {
  /**
   * A unique ID for the drop. This is used as a key for the DOM nodes, so they
   * are tracked uniquely and have their own CSS animations.
   */
  id: number;

  /**
   * All the skills that the player gained experience in.
   */
  amounts: { skill: Skill; amount: Experience }[];

  /**
   * Age of the drop, for deleting when it gets old
   */
  creationTimeMS: number;
}

export interface NPCInteraction {
  /**
   * Name of the NPC
   */
  name: string;

  /**
   * The ratio of the NPC's health currently, from 0 to 1. Undefined if the NPC
   * has no hitpoints, such as for a talkative NPC in a town.
   *
   * OSRS does not share actual hitpoints to the client, so we just have the
   * ratio.
   */
  healthRatio: number | undefined;

  /**
   * Position in the world the NPC was interacted with.
   */
  location: {
    x: number;
    y: number;
    plane: number;
  };

  /**
   * When the NPC was interacted with.
   */
  lastUpdated: Date;
}

export interface Stats {
  health: { current: number; max: number };
  run: { current: number; max: number };
  prayer: { current: number; max: number };
  world: number;
}
