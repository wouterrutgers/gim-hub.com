import * as z from "zod/v4";

const grandExchangePricesSchema = z.record(z.string().regex(/^\d+$/), z.uint32()).transform(function mapPrices(prices) {
  return new Map(Object.entries(prices).map(([itemId, price]) => [Number.parseInt(itemId), price]));
});

export async function fetchGEPrices({ baseURL }) {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const cacheBuster = Math.floor(Date.now() / FOUR_HOURS_MS);
  const response = await fetch(`${baseURL}/ge-prices.json?v=${cacheBuster}`);

  if (!response.ok) {
    throw new Error("Grand Exchange prices HTTP response was not OK");
  }

  return grandExchangePricesSchema.parseAsync(await response.json());
}
