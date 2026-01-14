import * as z from "zod/v4";
import type { ItemID } from "../../game/items";

export type Response = z.infer<typeof GEPricesSchema>;

/**
 * Returns a promise that resolves with a snapshot of all GE prices of all
 * items, or rejects with a reason if there was some error.
 *
 * @param baseURL Base URL of API, such as https://backend.foo.com/api/
 */
export const fetchGEPrices = ({ baseURL }: { baseURL: string }): Promise<Response> => {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const cacheBuster = Math.floor(Date.now() / FOUR_HOURS_MS);

  return fetch(`${baseURL}/ge-prices.json?v=${cacheBuster}`)
    .then((response) => response.json())
    .then((json) => GEPricesSchema.safeParseAsync(json))
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse GEPrices response", { cause: parseResult.error });
      return parseResult.data;
    });
};

export type GEPrices = Map<ItemID, number>;

const GEPricesSchema = z
  .record(
    z
      .string()
      .transform((id) => Number.parseInt(id))
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    z.uint32(),
  )
  .transform((record) => {
    const prices = new Map<ItemID, number>();
    Object.entries(record).forEach(([itemIDString, price]) => {
      const itemID = parseInt(itemIDString) as ItemID;
      prices.set(itemID, price);
    });
    return prices;
  });
