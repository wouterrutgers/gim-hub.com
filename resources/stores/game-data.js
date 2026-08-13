import { shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";

export const useGameDataStore = defineStore("gameData", function createGameDataStore() {
  const apiStore = useApiStore();
  const gameData = shallowRef({});
  let loadedClient;
  let loadingClient;
  let loadingPromise;

  async function load(client = apiStore.client) {
    if (!client) {
      throw new Error("No active API connection.");
    }

    if (client === loadedClient) {
      return gameData.value;
    }

    if (client === loadingClient) {
      return loadingPromise;
    }

    loadingClient = client;
    loadingPromise = client.fetchGameData();

    try {
      const loadedGameData = await loadingPromise;

      if (client === apiStore.client) {
        gameData.value = loadedGameData;
        loadedClient = client;
      }

      return loadedGameData;
    } finally {
      if (client === loadingClient) {
        loadingClient = undefined;
        loadingPromise = undefined;
      }
    }
  }

  watch(
    function getClient() {
      return apiStore.client;
    },
    function loadClientGameData(client) {
      gameData.value = {};
      loadedClient = undefined;

      if (client !== loadingClient) {
        loadingClient = undefined;
        loadingPromise = undefined;
      }

      if (client) {
        load(client).catch(function reportGameDataError(reason) {
          console.error("Failed to fetch game data", reason);
        });
      }
    },
    { immediate: true },
  );

  return { gameData, load };
});
