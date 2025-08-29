import type { Distinct } from "../ts/util";
import type { ItemID } from "./items";

export const TabName = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
export type TabName = (typeof TabName)[number];
export type PageName = Distinct<string, "CollectionLog.PageName">;
export interface Page {
  name: PageName;
  completionLabels: string[];
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
  [29472 as ItemID, 12013 as ItemID],
  [29474 as ItemID, 12014 as ItemID],
  [29476 as ItemID, 12015 as ItemID],
  [29478 as ItemID, 12016 as ItemID],
]);

export const canonicalizeCollectionLogItemId = (id: ItemID): ItemID => COLLECTION_LOG_ITEM_ALIASES.get(id) ?? id;
