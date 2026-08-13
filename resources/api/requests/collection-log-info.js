import * as z from "zod/v4";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";
import { fetchVersionedData } from "../fetch-versioned-data";

const tabsById = ["Bosses", "Raids", "Clues", "Minigames", "Other"];
const collectionLogInfoSchema = z
  .array(
    z.object({
      tabId: z
        .number()
        .int()
        .min(0)
        .max(tabsById.length - 1),
      pages: z.array(
        z.object({
          name: z.string(),
          items: z.array(z.object({ id: z.uint32(), name: z.string() })),
        }),
      ),
    }),
  )
  .transform(mapCollectionLogInfo);

export async function fetchCollectionLogInfo() {
  const data = await fetchVersionedData("/data/collection_log_info.json");

  return collectionLogInfoSchema.parseAsync(data);
}

function mapCollectionLogInfo(data) {
  const seenItemIds = new Set();
  const tabs = new Map();

  for (const { tabId, pages } of data) {
    const mappedPages = pages.map(function mapPage({ name, items }) {
      const itemIds = items.map(function mapItem({ id }) {
        return canonicalizeCollectionLogItemId(id);
      });

      itemIds.forEach(function rememberItem(itemId) {
        seenItemIds.add(itemId);
      });

      return { name, items: itemIds };
    });

    tabs.set(tabsById[tabId], mappedPages);
  }

  return { uniqueSlots: seenItemIds.size, tabs };
}
