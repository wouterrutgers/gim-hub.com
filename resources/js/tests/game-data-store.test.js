// @vitest-environment jsdom

import { setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { useGameDataStore } from "../../stores/game-data";
import LiveClient from "../../api/live-client";
import gameDataManifest from "@manifests/data";
import diaryData from "../../assets/data/diary_data.json";

function createDeferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise(function createPromise(resolvePromise, rejectPromise) {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("game data store", function describeGameDataStore() {
  it("shares concurrent loads and caches successful active-client data", async function testSharedLoad() {
    setActivePinia(createTestPinia());
    const apiStore = useApiStore();
    const gameDataStore = useGameDataStore();
    const request = createDeferredPromise();
    const client = {
      fetchGameData: vi.fn(function fetchGameData() {
        return request.promise;
      }),
    };
    apiStore.client = client;

    const firstLoad = gameDataStore.load(client);
    const secondLoad = gameDataStore.load(client);
    request.resolve({ items: new Map() });

    expect(await firstLoad).toEqual({ items: new Map() });
    expect(await secondLoad).toEqual({ items: new Map() });
    expect(await gameDataStore.load(client)).toBe(gameDataStore.gameData);
    expect(client.fetchGameData).toHaveBeenCalledOnce();
  });

  it("retries after a failed load", async function testRetry() {
    setActivePinia(createTestPinia());
    const gameDataStore = useGameDataStore();
    const client = {
      fetchGameData: vi
        .fn()
        .mockRejectedValueOnce(new Error("Unavailable"))
        .mockResolvedValueOnce({ quests: new Map() }),
    };

    await expect(gameDataStore.load(client)).rejects.toThrow("Unavailable");
    await expect(gameDataStore.load(client)).resolves.toEqual({ quests: new Map() });
    expect(client.fetchGameData).toHaveBeenCalledTimes(2);
  });

  it("retries when one game data source fails instead of caching an incomplete result", async function testSourceRetry() {
    setActivePinia(createTestPinia());
    const gameDataStore = useGameDataStore();
    const client = new LiveClient({ name: "test-group", token: "test-token" });
    const responses = new Map([
      [gameDataManifest["/data/quest_data.json"], {}],
      [gameDataManifest["/data/item_data.json"], {}],
      [gameDataManifest["/data/item_tags.json"], { tags: [], items: {} }],
      [gameDataManifest["/data/diary_data.json"], diaryData],
      [gameDataManifest["/data/combat_achievements.json"], []],
      [gameDataManifest["/data/collection_log_info.json"], []],
    ]);
    let pricesUnavailable = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async function fetchData(url) {
      if (url.startsWith("/api/ge-prices.json")) {
        return pricesUnavailable ? new Response("", { status: 503 }) : Response.json({ 4151: 1_500_000 });
      }

      return Response.json(responses.get(url));
    });

    await expect(gameDataStore.load(client)).rejects.toThrow();
    pricesUnavailable = false;
    const gameData = await gameDataStore.load(client);

    expect(gameData.gePrices).toEqual(new Map([[4151, 1_500_000]]));
    expect(gameData.items).toBeInstanceOf(Map);
  });

  it("does not let a stale client replace current game data", async function testStaleClient() {
    setActivePinia(createTestPinia());
    const apiStore = useApiStore();
    const gameDataStore = useGameDataStore();
    const firstRequest = createDeferredPromise();
    const secondRequest = createDeferredPromise();
    const firstClient = {
      fetchGameData: vi.fn(function fetchGameData() {
        return firstRequest.promise;
      }),
    };
    const secondClient = {
      fetchGameData: vi.fn(function fetchGameData() {
        return secondRequest.promise;
      }),
    };

    apiStore.client = firstClient;
    const firstLoad = gameDataStore.load(firstClient);
    apiStore.client = secondClient;
    const secondLoad = gameDataStore.load(secondClient);
    secondRequest.resolve({ source: "current" });
    await secondLoad;
    firstRequest.resolve({ source: "stale" });
    await firstLoad;

    expect(gameDataStore.gameData).toEqual({ source: "current" });
  });
});
