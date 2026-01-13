import * as z from "zod/v4";
import type { ItemID } from "../../game/items";
import * as CollectionLog from "../../game/collection-log";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";
import { fetchVersionedJSON } from "../../ts/fetch-data";

export type Response = z.infer<typeof CollectionLogInfoSchema>;
export const fetchCollectionLogInfo = ({ baseURL: _ }: { baseURL: string }): Promise<Response> =>
  fetchVersionedJSON("/data/collection_log_info.json")
    .then((json) => {
      if (json === undefined) throw new Error("Unable to resolve versioned JSON asset: /data/collection_log_info.json");

      return CollectionLogInfoSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("collection-log-info response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });

const PageSchema = z
  .object({
    name: z.string().transform((pageName) => pageName as CollectionLog.PageName),
    items: z
      .object({ id: z.uint32().transform((id) => id as ItemID), name: z.string() })
      /* Throw away name since we can look that up in the game data */
      .transform((item) => item.id)
      .array()
      .transform((ids) => ids.map((id) => canonicalizeCollectionLogItemId(id))),
  })
  .transform(({ name, items }) => ({ name, items }));

type Page = z.infer<typeof PageSchema>;

const TabByID = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
const CollectionLogInfoSchema = z
  .object({
    tabId: z.custom<number>((id) => typeof id === "number" && id >= 0 && id <= TabByID.length),
    pages: PageSchema.array(),
  })
  .array()
  .transform((tabsFlat) => {
    const seenItemIDs = new Set<ItemID>();
    const tabs = tabsFlat.reduce<Map<CollectionLog.TabName, Page[]>>((tabsMap, { tabId, pages }) => {
      tabsMap.set(TabByID[tabId], pages);
      pages.flatMap((page) => page.items).forEach((itemID) => seenItemIDs.add(canonicalizeCollectionLogItemId(itemID)));
      return tabsMap;
    }, new Map());

    return { uniqueSlots: seenItemIDs.size, tabs };
  });
