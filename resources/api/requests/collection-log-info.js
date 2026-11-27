import * as z from "zod/v4";
import { canonicalizeCollectionLogItemId, tabNames } from "../../game/collection-log";
import { fetchVersionedData } from "../fetch-versioned-data";

const collectionLogInfoSchema = z
  .array(
    z.object({
      tabId: z
        .number()
        .int()
        .min(0)
        .max(tabNames.length - 1),
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
  const itemPages = new Map();
  const tabs = new Map();

  for (const { tabId, pages } of data) {
    const tab = tabNames[tabId];
    const mappedPages = pages.map(function mapPage({ name, items }, index) {
      const page = { tab, index };
      const itemIds = items.map(function mapItem({ id }) {
        const itemId = canonicalizeCollectionLogItemId(id);

        if (!itemPages.has(itemId)) {
          itemPages.set(itemId, page);
        }

        return itemId;
      });

      return { name, items: itemIds };
    });

    tabs.set(tab, mappedPages);
  }

  return { uniqueSlots: itemPages.size, tabs, itemPages };
}
