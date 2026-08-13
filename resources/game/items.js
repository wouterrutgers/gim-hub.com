import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";

const itemDataSchema = z
  .record(
    z.string().regex(/^\d+$/),
    z.object({
      name: z.string(),
      highalch: z.uint32(),
      alchable: z.boolean(),
      stacks: z
        .array(z.tuple([z.uint32(), z.uint32()]))
        .min(1)
        .optional(),
      mapping: z
        .array(z.object({ id: z.uint32(), quantity: z.uint32() }))
        .optional()
        .nullable(),
    }),
  )
  .transform(function mapItemData(itemData) {
    return new Map(Object.entries(itemData).map(([itemId, item]) => [Number.parseInt(itemId), item]));
  });
const itemTagsSchema = z.object({
  tags: z.array(z.string().nonempty()).transform(function mapTags(tags) {
    return tags.map((tag, index) => [tag, index]);
  }),
  items: z.record(
    z.string(),
    z
      .string()
      .nonempty()
      .transform(function parseTags(tags) {
        return BigInt(tags);
      }),
  ),
});
export function composeItemIconHref({ itemID, quantity }, itemDatum) {
  let id = itemID;
  if (itemDatum?.stacks) {
    for (const [stackBreakpoint, stackItemID] of itemDatum.stacks) {
      if (stackBreakpoint > quantity) break;
      id = stackItemID;
    }
  }
  return `/item-icons/${id}.webp`;
}

export function isRunePouch(id) {
  const RUNE_POUCH = 12791;
  const DIVINE_RUNE_POUCH = 27281;
  return id === RUNE_POUCH || id === DIVINE_RUNE_POUCH;
}

export async function fetchItemData() {
  const data = await fetchVersionedData("/data/item_data.json");

  return itemDataSchema.parseAsync(data);
}

export async function fetchItemTags() {
  const data = await fetchVersionedData("/data/item_tags.json");

  return itemTagsSchema.parseAsync(data);
}

export function quantityColor(quantity) {
  if (quantity >= 10_000_000) return "#00ff00";
  if (quantity >= 100_000) return "#ffffff";
  return "#ffff00";
}

export function formatShortQuantity(quantity) {
  if (quantity >= 1000000000) {
    return Math.floor(quantity / 1000000000) + "B";
  } else if (quantity >= 10000000) {
    return Math.floor(quantity / 1000000) + "M";
  } else if (quantity >= 100000) {
    return Math.floor(quantity / 1000) + "K";
  }
  return quantity.toString();
}

export function formatVeryShortQuantity(quantity) {
  if (quantity >= 1000 && quantity < 100000) {
    return Math.floor(quantity / 1000) + "K";
  }
  return formatShortQuantity(quantity);
}
function resolveItemVariant(itemID, items, visited = new Set()) {
  if (!items) return itemID;
  if (visited.has(itemID)) return itemID;
  visited.add(itemID);
  const itemEntry = items.get(itemID);
  const mapping = itemEntry?.mapping;
  if (mapping?.length !== 1 || mapping[0].quantity !== 1) {
    return itemID;
  }
  const next = mapping[0].id;
  if (next === itemID) return itemID;
  return resolveItemVariant(next, items, visited);
}

export function mappedHighAlch(itemID, items) {
  if (!items) return 0;
  const itemEntry = items.get(itemID);
  if (!itemEntry) return 0;
  if (itemEntry.alchable) return itemEntry.highalch;
  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return 0;
  const resolvedEntry = items.get(resolvedID);
  if (!resolvedEntry?.alchable) return 0;
  return resolvedEntry.highalch;
}

export function mappedAlchable(itemID, items) {
  if (!items) return false;
  const itemEntry = items.get(itemID);
  if (!itemEntry) return false;
  if (itemEntry.alchable) return true;
  const resolvedID = resolveItemVariant(itemID, items);
  if (resolvedID === itemID) return false;
  return Boolean(items.get(resolvedID)?.alchable);
}

export function mappedGEPrice(itemID, gePrices, items, memo = new Map(), visited = new Set()) {
  if (!gePrices || !items) {
    return 0;
  }
  if (memo.has(itemID)) {
    return memo.get(itemID);
  }
  if (itemID === 995) {
    memo.set(itemID, 1);
    return 1;
  }
  if (itemID === 13204) {
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
      return sum + mappedGEPrice(id, gePrices, items, memo, visited) * quantity;
    }, 0);
    visited.delete(itemID);
    memo.set(itemID, total);
    return total;
  }
  const direct = gePrices.get(itemID) ?? 0;
  memo.set(itemID, direct);
  return direct;
}
