import { describe, expect, it, vi } from "vite-plus/test";
import { fetchGEPrices } from "../../api/requests/ge-prices";

describe("Grand Exchange prices", function describeGrandExchangePrices() {
  it("loads all prices when an item exceeds the old price limit", async function testLargePrice() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ 4151: 1_500_000, 20014: 8_490_000_000 }));

    const prices = await fetchGEPrices({ baseURL: "/api" });

    expect(prices).toEqual(
      new Map([
        [4151, 1_500_000],
        [20014, 8_490_000_000],
      ]),
    );
  });
});
