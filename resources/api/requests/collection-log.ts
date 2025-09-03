import * as z from "zod/v4";
import type { ItemID } from "../../game/items";
import type { GroupCredentials } from "../credentials";
import * as Member from "../../game/member";
import * as CollectionLog from "../../game/collection-log";

export type Response = z.infer<typeof CollectionLogSchema>;
export const fetchGroupCollectionLogs = ({
  baseURL,
  credentials,
}: {
  baseURL: string;
  credentials: GroupCredentials;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/collection-log`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("collection-log HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => {
      return CollectionLogSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("collection-log response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });

const CollectionLogSchema = z
  .record(
    z.string().transform((name) => name as Member.Name),
    z
      .object({
        page_name: z.string().transform((page) => page as CollectionLog.PageName),
        completion_counts: z.uint32().array(),
        items: z
          .uint32()
          .array()
          .refine((arg) => arg.length % 2 === 0)
          .transform((arg: number[]) =>
            arg.reduce<Map<ItemID, number>>((items, _, index, flatItems) => {
              if (index % 2 !== 0 || index + 1 >= flatItems.length) return items;

              const itemID = flatItems[index] as ItemID;
              const itemQuantity = flatItems[index + 1];

              items.set(itemID, itemQuantity + (items.get(itemID) ?? 0));

              return items;
            }, new Map<ItemID, number>()),
          ),
        new_items: z
          .uint32()
          .array()
          .transform((items) => items as ItemID[]),
      })
      .array()
      .transform((pagesFlat) => {
        const obtainedItems = new Map<CollectionLog.ItemIDDeduped, number>();
        const pageStats = new Map<CollectionLog.PageName, { completions: number[] }>();

        pagesFlat.forEach((page) => {
          // We overwrite the amounts, since all instances of the same item ID should
          // report the same quantity, even after deduplicating.

          // TODO: The backend should deduplicate and aggregate collection log item IDs.

          // TODO: investigate what the significance of new_items is

          page.new_items.forEach((itemID) => obtainedItems.set(CollectionLog.deduplicateItemID(itemID), 1));
          page.items.forEach((quantity, itemID) => {
            obtainedItems.set(CollectionLog.deduplicateItemID(itemID), quantity);
          });

          pageStats.set(page.page_name, { completions: [...page.completion_counts] });
        });

        return {
          obtainedItems,
          pageStats,
        };
      }),
  )
  .or(
    z
      .array(z.any())
      .length(0)
      .transform((_) => ({})),
  );
