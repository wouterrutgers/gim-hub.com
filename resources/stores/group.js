import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";
import { useGameDataStore } from "./game-data";
import { createGroupState, mapGroupResponse, updateGroupMemberColors, updateGroupState } from "./group-state";

const FETCH_INTERVAL_MILLISECONDS = 1000;

export const useGroupStore = defineStore("group", function createGroupStore() {
  const apiStore = useApiStore();
  const gameDataStore = useGameDataStore();
  const state = shallowRef(createGroupState());
  const collectionLogsLoaded = ref(false);

  const items = computed(function getItems() {
    return state.value.items;
  });
  const memberStates = computed(function getMemberStates() {
    return state.value.memberStates;
  });
  const memberNames = computed(function getMemberNames() {
    return state.value.memberNames;
  });
  const memberColors = computed(function getMemberColors() {
    return state.value.memberColors;
  });
  const collections = computed(function getCollections() {
    return state.value.collections;
  });
  const experienceDrops = computed(function getExperienceDrops() {
    return state.value.xpDrops;
  });

  function updateMemberColors(updates) {
    state.value = updateGroupMemberColors(state.value, updates);
  }

  async function refreshCollectionLogs(client = apiStore.client) {
    if (!client) {
      throw new Error("No active API connection.");
    }

    const collections = await client.fetchGroupCollectionLogs();

    if (apiStore.client !== client) {
      return;
    }

    const updates = new Map();
    for (const [name, collection] of collections) {
      updates.set(name, { collection });
    }

    state.value = updateGroupState(state.value, updates, { partial: true });
  }

  watch(
    function getClient() {
      return apiStore.client;
    },
    function connectClient(client, _previousClient, onCleanup) {
      state.value = createGroupState();
      collectionLogsLoaded.value = false;

      if (!client) {
        return;
      }

      let cancelled = false;
      let timeout;
      let validUpTo = new Date(0);

      async function pollGroupData() {
        try {
          await gameDataStore.load(client);

          if (cancelled) {
            return;
          }

          const response = await client.fetchGroupData(new Date(validUpTo.getTime() + 1));

          if (cancelled) {
            return;
          }

          const { updates, colorUpdates, newestTimestamp } = mapGroupResponse(response, gameDataStore.gameData.quests);
          state.value = updateGroupState(state.value, updates, { colorUpdates });
          validUpTo = newestTimestamp;
        } catch (reason) {
          console.error("Failed to get group data", reason);
        }

        if (!cancelled) {
          timeout = window.setTimeout(pollGroupData, FETCH_INTERVAL_MILLISECONDS);
        }
      }

      refreshCollectionLogs(client)
        .catch(function reportCollectionLogError(reason) {
          console.error("Failed to fetch collection logs", reason);
        })
        .finally(function finishCollectionLogs() {
          if (!cancelled) {
            collectionLogsLoaded.value = true;
          }
        });
      void pollGroupData();

      onCleanup(function disconnectClient() {
        cancelled = true;
        window.clearTimeout(timeout);
      });
    },
    { immediate: true },
  );

  return {
    items,
    memberStates,
    memberNames,
    memberColors,
    collections,
    experienceDrops,
    collectionLogsLoaded,
    updateMemberColors,
    refreshCollectionLogs,
  };
});

function useGroupMember(selector) {
  const groupStore = useGroupStore();

  return computed(function selectGroupMemberState() {
    return selector(groupStore.memberStates);
  });
}

function createMemberSelector(key) {
  return function useMemberValue(getMember) {
    return useGroupMember(function selectMemberValue(state) {
      return state.get(typeof getMember === "function" ? getMember() : getMember)?.[key];
    });
  };
}

export const useMemberLastOnlineAt = createMemberSelector("lastOnlineAt");
export const useMemberRunePouch = createMemberSelector("runePouch");
export const useMemberQuiver = createMemberSelector("quiver");
export const useMemberEquipment = createMemberSelector("equipment");
export const useMemberInventory = createMemberSelector("inventory");
export const useMemberInteracting = createMemberSelector("interacting");
export const useMemberStats = createMemberSelector("stats");
export const useMemberSkills = createMemberSelector("skills");
export const useMemberQuests = createMemberSelector("quests");
export const useMemberDiaries = createMemberSelector("diaries");
export const useMemberTimezone = createMemberSelector("timezone");
