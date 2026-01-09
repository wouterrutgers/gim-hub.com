import * as z from "zod/v4";
import type { Distinct } from "../ts/util";
import type { GEPrices } from "../api/requests/ge-prices";

export type ItemID = Distinct<number, "ItemID">;
export interface ItemStack {
  itemID: ItemID;
  quantity: number;
}
export type Item = z.infer<typeof ItemsDataEntrySchema>;
export type ItemsDatabase = z.infer<typeof ItemsDataSchema>;
export type ItemTags = z.infer<typeof ItemsTagsSchema>;

export const composeItemIconHref = ({ itemID, quantity }: ItemStack, itemDatum?: Item): string => {
  let id = itemID;
  if (itemDatum?.stacks) {
    for (const [stackBreakpoint, stackItemID] of itemDatum.stacks) {
      if (stackBreakpoint > quantity) break;

      id = stackItemID as ItemID;
    }
  }

  return `/icons/items/${id}.webp`;
};
export const isRunePouch = (id: ItemID): boolean => {
  const RUNE_POUCH = 12791;
  const DIVINE_RUNE_POUCH = 27281;
  return id === RUNE_POUCH || id === DIVINE_RUNE_POUCH;
};
export const fetchItemDataJSON = (): Promise<ItemsDatabase> =>
  fetch("/data/item_data.json")
    .then((response) => response.json())
    .then((data) => {
      return ItemsDataSchema.safeParseAsync(data);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse item_data.json", { cause: parseResult.error });

      return parseResult.data;
    });

export const fetchItemTagsJSON = (): Promise<ItemTags> =>
  fetch("/data/item_tags.json")
    .then((response) => response.json())
    .then((data) => {
      return ItemsTagsSchema.safeParseAsync(data);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse item_tags.json", { cause: parseResult.error });

      return parseResult.data;
    });

export const formatShortQuantity = (quantity: number): string => {
  if (quantity >= 1000000000) {
    return Math.floor(quantity / 1000000000) + "B";
  } else if (quantity >= 10000000) {
    return Math.floor(quantity / 1000000) + "M";
  } else if (quantity >= 100000) {
    return Math.floor(quantity / 1000) + "K";
  }
  return quantity.toString();
};

export const formatVeryShortQuantity = (quantity: number): string => {
  if (quantity >= 1000 && quantity < 100000) {
    return Math.floor(quantity / 1000) + "K";
  }

  return formatShortQuantity(quantity);
};

const ItemsDataEntrySchema = z.object({
  name: z.string(),
  highalch: z.uint32(),
  alchable: z.boolean(),
  stacks: z
    .array(z.tuple([z.uint32(), z.uint32()]))
    .min(1)
    .optional(),
  mapping: z
    .array(
      z.object({
        id: z.uint32(),
        quantity: z.uint32(),
      }),
    )
    .optional()
    .nullable(),
});
type ItemEntry = z.infer<typeof ItemsDataEntrySchema>;

const ItemsDataSchema = z
  .record(
    z
      .string()
      .transform((id) => Number.parseInt(id))
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    ItemsDataEntrySchema,
  )
  .transform((itemData) => {
    const result = new Map<ItemID, ItemEntry>();
    for (const [itemIDString, itemDataEntry] of Object.entries(itemData)) {
      result.set(parseInt(itemIDString) as ItemID, itemDataEntry);
    }
    return result;
  });

const ItemsTagsSchema = z.object({
  tags: z.array(z.string().nonempty()).transform((tags) => tags.map((tag, index) => [tag, index] as [string, number])),
  items: z.record(
    z
      .string()
      .transform((id) => Number.parseInt(id) as ItemID)
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    z
      .string()
      .nonempty()
      .transform((s) => BigInt(s)),
  ),
});

export const resolveItemVariant = (
  itemID: ItemID,
  items: ItemsDatabase | undefined,
  visited: Set<ItemID> = new Set(),
): ItemID => {
  if (!items) return itemID;
  if (visited.has(itemID)) return itemID;
  visited.add(itemID);

  const itemEntry = items.get(itemID);
  const mapping = itemEntry?.mapping;
  if (mapping?.length !== 1 || mapping[0].quantity !== 1) {
    return itemID;
  }

  const next = mapping[0].id as ItemID;
  if (next === itemID) return itemID;

  return resolveItemVariant(next, items, visited);
};

export const mappedHighAlch = (itemID: ItemID, items: ItemsDatabase | undefined): number => {
  if (!items) return 0;

  const itemEntry = items.get(itemID);
  if (!itemEntry) return 0;

  if (itemEntry.alchable) return itemEntry.highalch;

  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return 0;

  const resolvedEntry = items.get(resolvedID);
  if (!resolvedEntry?.alchable) return 0;

  return resolvedEntry.highalch;
};

export const mappedAlchable = (itemID: ItemID, items: ItemsDatabase | undefined): boolean => {
  if (!items) return false;

  const itemEntry = items.get(itemID);
  if (!itemEntry) return false;

  if (itemEntry.alchable) return true;

  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return false;

  return Boolean(items.get(resolvedID)?.alchable);
};

export const mappedGEPrice = (
  itemID: ItemID,
  gePrices: GEPrices | undefined,
  items: ItemsDatabase | undefined,
  memo: Map<ItemID, number> = new Map(),
  visited: Set<ItemID> = new Set(),
): number => {
  if (!gePrices || !items) {
    return 0;
  }

  if (memo.has(itemID)) {
    return memo.get(itemID)!;
  }

  if (itemID === (995 as ItemID)) {
    memo.set(itemID, 1);

    return 1;
  }

  if (itemID === (13204 as ItemID)) {
    memo.set(itemID, 1000);

    return 1000;
  }

  const itemEntry = items.get(itemID);
  if (!itemEntry) {
    return 0;
  }

  if (itemEntry.mapping && itemEntry.mapping.length > 0) {
    visited.add(itemID);
    const total = itemEntry.mapping.reduce((sum, { id, quantity }) => {
      return sum + mappedGEPrice(id as ItemID, gePrices, items, memo, visited) * quantity;
    }, 0);
    visited.delete(itemID);
    memo.set(itemID, total);

    return total;
  }

  const direct = gePrices.get(itemID) ?? 0;
  memo.set(itemID, direct);

  return direct;
};
