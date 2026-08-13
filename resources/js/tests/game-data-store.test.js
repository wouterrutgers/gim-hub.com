// @vitest-environment jsdom

import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useApiStore } from "../../stores/api";
import { useGameDataStore } from "../../stores/game-data";

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
  afterEach(function cleanup() {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shares concurrent loads and caches successful active-client data", async function testSharedLoad() {
    setActivePinia(createPinia());
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
    setActivePinia(createPinia());
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

  it("does not let a stale client replace current game data", async function testStaleClient() {
    setActivePinia(createPinia());
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
