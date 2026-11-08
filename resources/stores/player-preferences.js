import { computed, onScopeDispose, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useRoute } from "vue-router";
import * as z from "zod/v4";
import { fetchMemberPreferences } from "../api/requests/member-preferences";
import { fetchChangelog } from "../api/requests/changelog";
import { useLocalStorage } from "../composables/local-storage";
import { useApiStore } from "./api";
import { useGroupStore } from "./group";
import { DEFAULT_PLAYER_PREFERENCES, useSettingsStore } from "./settings";
import { clearLegacyPreferences, readLegacyPreferences } from "./legacy-preferences";
import { cachePlayerPreferences, clearCachedPlayerPreferences, readCachedPlayer } from "./cached-player-preferences";

const preferenceActions = {
  setSiteTheme: "siteTheme",
  setPageBackgroundOpacity: "pageBackgroundOpacity",
  setEnableVirtualLevels: "enableVirtualLevels",
  setEnableSkillProgressBars: "enableSkillProgressBars",
  setEnableGearscapeExport: "enableGearscapeExport",
  setExpandPlayerHistory: "expandPlayerHistory",
  setCollapseNavigation: "collapseNavigation",
  setShowItemOwners: "showItemOwners",
  setShowActivitySidebar: "showActivitySidebar",
  setFilterActivityDrops: "filterActivityDrops",
  setPinnedItemIds: "pinnedItemIds",
  setDismissedPluginWarningVersions: "dismissedPluginWarningVersions",
};

function validateSelections(value) {
  try {
    return z.record(z.string(), z.number().int().positive().nullable()).safeParse(JSON.parse(value)).success
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export const usePlayerPreferencesStore = defineStore("player-preferences", function createPlayerPreferencesStore() {
  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const [storedSelections, setStoredSelections] = useLocalStorage({
    key: "selected-players",
    defaultValue: "{}",
    validator: validateSelections,
  });
  const selectedMemberId = ref();
  const preferences = ref();
  const chooserOpen = ref(false);
  const pending = ref(false);
  const error = ref();
  const saveError = ref();
  const status = ref("");
  const changelogEntries = ref([]);
  const viewingChangelog = ref(false);
  let generation = 0;
  let selectionAttempt = 0;
  let preferenceRevision = 0;
  let pendingChanges = {};
  let saving;
  let activeClient;
  let restored = false;

  const members = computed(function getMembers() {
    return [...groupStore.memberStates]
      .filter(function excludeShared([name]) {
        return name !== "@SHARED";
      })
      .map(function getMember([name, member]) {
        return { id: member.id, name };
      });
  });
  const selectedMemberName = computed(function getSelectedMemberName() {
    return members.value.find(function isSelectedMember(member) {
      return member.id === selectedMemberId.value;
    })?.name;
  });
  const displayMemberId = computed(function getDisplayMemberId() {
    return selectedMemberId.value ?? JSON.parse(storedSelections.value)[apiStore.credentials?.name];
  });
  const displayMemberName = computed(function getDisplayMemberName() {
    return (
      members.value.find(function isDisplayedMember(member) {
        return member.id === displayMemberId.value;
      })?.name ?? readCachedPlayer(apiStore.credentials?.name)?.memberName
    );
  });
  const unseenEntries = computed(function getUnseenEntries() {
    if (!preferences.value?.seenChangelogIds) {
      return [];
    }

    return changelogEntries.value.filter(function isUnseen(entry) {
      return !preferences.value.seenChangelogIds.includes(entry.id);
    });
  });
  const changelogOpen = computed(function shouldShowChangelog() {
    return Boolean(selectedMemberId.value && !viewingChangelog.value && unseenEntries.value.length);
  });

  function rememberSelection(memberId) {
    setStoredSelections(
      JSON.stringify({ ...JSON.parse(storedSelections.value), [activeClient.credentials.name]: memberId }),
    );
  }

  function reset(cachedPreferences) {
    generation += 1;
    selectedMemberId.value = undefined;
    preferences.value = undefined;
    pendingChanges = {};
    saving = undefined;
    pending.value = false;
    chooserOpen.value = false;
    error.value = undefined;
    saveError.value = undefined;
    status.value = "";
    changelogEntries.value = [];
    settingsStore.setPlayerPreferences(cachedPreferences);
  }

  function cachePreferences() {
    cachePlayerPreferences(
      activeClient.credentials.name,
      selectedMemberId.value,
      selectedMemberName.value,
      settingsStore,
    );
  }

  function requestPreferences(memberId, changes) {
    return fetchMemberPreferences({
      baseURL: activeClient.baseURL,
      credentials: activeClient.credentials,
      memberId,
      changes,
    });
  }

  async function saveQueuedChanges() {
    const currentGeneration = generation;
    const memberId = selectedMemberId.value;

    while (Object.keys(pendingChanges).length) {
      const changes = pendingChanges;
      pendingChanges = {};

      try {
        const response = await requestPreferences(memberId, changes);

        if (generation !== currentGeneration) {
          return false;
        }

        preferences.value = response;
        saveError.value = undefined;
      } catch (reason) {
        if (generation !== currentGeneration) {
          return false;
        }

        console.error("Failed to save player preferences:", reason);

        if (changes.seenChangelogIds) {
          pendingChanges.seenChangelogIds = [
            ...new Set([...changes.seenChangelogIds, ...(pendingChanges.seenChangelogIds ?? [])]),
          ];
        }

        pendingChanges = { ...changes, ...pendingChanges };
        saveError.value = "Could not save your preferences. Please try again.";

        return false;
      }
    }

    return true;
  }

  async function saveChanges() {
    if (!selectedMemberId.value) {
      return true;
    }

    if (saving) {
      return saving;
    }

    const operation = saveQueuedChanges();
    saving = operation;
    const result = await operation;

    if (saving === operation) {
      saving = undefined;
    }

    return result;
  }

  async function markChangelogRead(entries) {
    if (!selectedMemberId.value || apiStore.isDemo) {
      return;
    }

    const ids = entries.map(function getId(entry) {
      return entry.id;
    });

    if (
      preferences.value.seenChangelogIds &&
      ids.every(function isRead(id) {
        return preferences.value.seenChangelogIds.includes(id);
      })
    ) {
      return;
    }

    pendingChanges.seenChangelogIds = [...new Set([...(pendingChanges.seenChangelogIds ?? []), ...ids])];
    preferenceRevision += 1;
    await saveChanges();
  }

  async function refresh() {
    if (!selectedMemberId.value || pending.value || !(await saveChanges())) {
      return;
    }

    const currentGeneration = generation;
    const revision = preferenceRevision;

    try {
      const [response, entries] = await Promise.all([
        requestPreferences(selectedMemberId.value),
        fetchChangelog({ baseURL: activeClient.baseURL }),
      ]);

      if (generation !== currentGeneration || revision !== preferenceRevision) {
        return;
      }

      preferences.value = response;
      changelogEntries.value = entries;
      settingsStore.setPlayerPreferences(response ?? DEFAULT_PLAYER_PREFERENCES);
      cachePreferences();
      saveError.value = undefined;

      if (!response?.seenChangelogIds || viewingChangelog.value) {
        await markChangelogRead(entries);
      }
    } catch (reason) {
      if (generation === currentGeneration && revision === preferenceRevision) {
        console.error("Failed to refresh player preferences:", reason);
        saveError.value = "Could not refresh your preferences. Please try again.";
      }
    }
  }

  async function choosePlayer(memberId) {
    if (pending.value || !activeClient || apiStore.isDemo) {
      return false;
    }

    pending.value = true;
    error.value = undefined;
    const currentGeneration = generation;
    const attempt = ++selectionAttempt;

    try {
      const saved = await saveChanges();

      if (generation !== currentGeneration || selectionAttempt !== attempt) {
        return false;
      }

      if (!saved) {
        error.value = "Could not save your current preferences. Please try again.";

        return false;
      }

      let response = await requestPreferences(memberId);

      if (generation !== currentGeneration || selectionAttempt !== attempt) {
        return false;
      }

      if (
        !response ||
        Object.keys(DEFAULT_PLAYER_PREFERENCES).some(function isMissing(key) {
          return response[key] === undefined;
        })
      ) {
        response = await requestPreferences(memberId, {
          ...DEFAULT_PLAYER_PREFERENCES,
          ...readLegacyPreferences(),
          initialize: true,
        });
      }

      if (generation !== currentGeneration || selectionAttempt !== attempt) {
        return false;
      }

      clearLegacyPreferences();
      generation += 1;
      preferences.value = response;
      selectedMemberId.value = memberId;
      settingsStore.setPlayerPreferences(response);
      rememberSelection(memberId);
      cachePreferences();
      status.value = `Using preferences for ${selectedMemberName.value}.`;
      pending.value = false;
      chooserOpen.value = false;
      await refresh();

      return true;
    } catch (reason) {
      if (generation === currentGeneration && selectionAttempt === attempt) {
        console.error("Failed to select player:", reason);
        error.value = "Could not load preferences. Please try again.";
      }

      return false;
    } finally {
      if (generation === currentGeneration && selectionAttempt === attempt) {
        pending.value = false;
      }
    }
  }

  function openChooser() {
    if (members.value.length === 0) {
      return;
    }

    error.value = undefined;
    chooserOpen.value = true;
  }

  function closeChooser() {
    if (!selectedMemberId.value) {
      return;
    }

    selectionAttempt += 1;
    pending.value = false;
    chooserOpen.value = false;
    error.value = undefined;
  }

  async function dismissChangelog() {
    await markChangelogRead(unseenEntries.value);
  }

  async function retrySave() {
    await refresh();
  }

  function start() {
    const route = useRoute();
    watch(
      function getPath() {
        return route.path;
      },
      function updateChangelogRoute(path) {
        viewingChangelog.value = path === "/changelog";
      },
      { immediate: true },
    );

    watch(
      function getGroup() {
        return [
          apiStore.client,
          groupStore.loaded,
          members.value
            .map(function getId(member) {
              return member.id;
            })
            .join(","),
        ];
      },
      async function restoreSelection() {
        if (activeClient !== apiStore.client) {
          reset(
            apiStore.client && !apiStore.isDemo
              ? readCachedPlayer(apiStore.client.credentials.name)?.preferences
              : undefined,
          );
          activeClient = apiStore.client;
          restored = false;
        }

        if (!activeClient || apiStore.isDemo || !groupStore.loaded) {
          return;
        }

        const selection = displayMemberId.value;

        if (
          selection &&
          !members.value.some(function isRememberedMember(member) {
            return member.id === selection;
          })
        ) {
          clearCachedPlayerPreferences(activeClient.credentials.name);
          rememberSelection(undefined);
          reset();
          restored = false;
        }

        if (members.value.length === 0 || restored) {
          return;
        }

        restored = true;

        if (
          members.value.some(function isRememberedMember(member) {
            return member.id === selection;
          })
        ) {
          if (!(await choosePlayer(selection)) && error.value) {
            chooserOpen.value = true;
          }

          return;
        }

        openChooser();
      },
      { immediate: true },
    );

    const unsubscribe = settingsStore.$onAction(function savePreferenceAction({ name, args, after }) {
      const key = preferenceActions[name];

      if (!key || !selectedMemberId.value) {
        return;
      }

      after(function queuePreference() {
        cachePreferences();
        preferenceRevision += 1;
        pendingChanges[key] = args[0];
        void saveChanges();
      });
    });
    window.addEventListener("focus", refresh);
    onScopeDispose(function stop() {
      unsubscribe();
      window.removeEventListener("focus", refresh);
      reset();
      activeClient = undefined;
      restored = false;
    });
  }

  return {
    selectedMemberId,
    selectedMemberName,
    displayMemberId,
    displayMemberName,
    members,
    chooserOpen,
    pending,
    error,
    saveError,
    status,
    unseenEntries,
    changelogOpen,
    openChooser,
    closeChooser,
    choosePlayer,
    dismissChangelog,
    retrySave,
    markChangelogRead,
    start,
  };
});
