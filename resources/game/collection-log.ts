import type { Distinct } from "../ts/util";
import type { ItemID } from "./items";

export const TabName = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
export type TabName = (typeof TabName)[number];
export type PageName = Distinct<string, "CollectionLog.PageName">;
export interface Page {
  name: PageName;
  items: ItemID[];
}
export interface CollectionLogInfo {
  /**
   * This is the total amount of unlockable slots.
   *
   * This is different than going through and totalling each page's items!
   * Duplicate item IDs across pages (such as the dragon pickaxe in all the
   * wilderness posses) are not double counted. Also, there are some unique item
   * IDs that count for each other, such as Motherlode Mine vs Volcanic
   * Mine prospector's gear.
   *
   * Per-page unlock count can safely be counted as the length of the items array.
   */
  uniqueSlots: number;

  /**
   * All tabs, with all of their pages.
   */
  tabs: Map<TabName, Page[]>;
}

const COLLECTION_LOG_ITEM_ALIASES: ReadonlyMap<ItemID, ItemID> = new Map<ItemID, ItemID>([
  [25629 as ItemID, 24882 as ItemID], // Plank sack
  [29992 as ItemID, 29990 as ItemID], // Alchemist's amulet
  [25630 as ItemID, 12854 as ItemID], // Flamtaer bag
  [25617 as ItemID, 10859 as ItemID], // Tea flask
  [25618 as ItemID, 10877 as ItemID], // Plain satchel
  [25619 as ItemID, 10878 as ItemID], // Green satchel
  [25620 as ItemID, 10879 as ItemID], // Red satchel
  [25621 as ItemID, 10880 as ItemID], // Black satchel
  [25622 as ItemID, 10881 as ItemID], // Gold satchel
  [25623 as ItemID, 10882 as ItemID], // Rune satchel
  [25627 as ItemID, 12019 as ItemID], // Coal bag
  [25628 as ItemID, 12020 as ItemID], // Gem bag
  [29472 as ItemID, 12013 as ItemID], // Prospector helmet
  [29474 as ItemID, 12014 as ItemID], // Prospector jacket
  [29476 as ItemID, 12015 as ItemID], // Prospector legs
  [29478 as ItemID, 12016 as ItemID], // Prospector boots
]);

export const canonicalizeCollectionLogItemId = (id: ItemID): ItemID => COLLECTION_LOG_ITEM_ALIASES.get(id) ?? id;
