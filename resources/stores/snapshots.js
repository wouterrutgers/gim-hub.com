import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";
import { useGroupStore } from "./group";

function snapshotSeenStorageKey(groupName) {
  return `recent-activity-seen-${groupName}`;
}

function parseSeenSnapshotMarkers(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const markers = {};

    for (const [member, timestamp] of Object.entries(parsed)) {
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
        markers[member] = timestamp;
      }
    }

    return markers;
  } catch {
    return {};
  }
}

function loadSeenSnapshotMarkers(storageKey) {
  return parseSeenSnapshotMarkers(localStorage.getItem(storageKey));
}

function saveSeenSnapshotMarkers(storageKey, markers) {
  localStorage.setItem(storageKey, JSON.stringify(markers));
  window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: storageKey } }));
}

export const useSnapshotStore = defineStore("snapshots", function createSnapshotStore() {
  const apiStore = useApiStore();
  const groupStore = useGroupStore();

  const serverSnapshots = shallowRef();
  const seenSnapshotState = ref({ markers: {} });

  const groupName = computed(function getGroupName() {
    return apiStore.credentials?.name;
  });

  function getBaselineSnapshot(playerName, view = "lastVisit") {
    if (!serverSnapshots.value || !groupStore.collectionLogsLoaded) {
      return undefined;
    }

    const baselines = serverSnapshots.value.get(playerName);

    if (!baselines) {
      return undefined;
    }

    return {
      snapshot: baselines[view],
      view,
      hasSeenMarker:
        seenSnapshotState.value.groupName === groupName.value &&
        seenSnapshotState.value.markers[playerName] !== undefined,
    };
  }

  async function clearBaselineSnapshot(playerName) {
    const snapshotClient = apiStore.client;
    const snapshotGroupName = groupName.value;

    if (!snapshotClient || !snapshotGroupName) {
      throw new Error("No active API connection.");
    }

    const snapshot = await snapshotClient.createMemberSnapshot(playerName);
    const storageKey = snapshotSeenStorageKey(snapshotGroupName);
    const markers = { ...loadSeenSnapshotMarkers(storageKey), [playerName]: snapshot.timestamp };
    saveSeenSnapshotMarkers(storageKey, markers);

    if (apiStore.client !== snapshotClient || groupName.value !== snapshotGroupName) {
      return;
    }

    const nextSnapshots = new Map(serverSnapshots.value);
    const previousBaselines = serverSnapshots.value?.get(playerName);
    nextSnapshots.set(playerName, {
      lastVisit: snapshot,
      lastWeek: previousBaselines?.lastWeek ?? snapshot,
    });
    serverSnapshots.value = nextSnapshots;
    seenSnapshotState.value = { groupName: snapshotGroupName, markers };
  }

  watch(
    groupName,
    function connectSeenSnapshotMarkers(newGroupName, _previousGroupName, onCleanup) {
      if (!newGroupName) {
        seenSnapshotState.value = { markers: {} };

        return;
      }

      const storageKey = snapshotSeenStorageKey(newGroupName);
      seenSnapshotState.value = { groupName: newGroupName, markers: loadSeenSnapshotMarkers(storageKey) };

      function handleStorageEvent(event) {
        const eventKey = event.type === "local-storage" ? event.detail?.key : (event.key ?? undefined);

        if (eventKey === storageKey) {
          seenSnapshotState.value = { groupName: newGroupName, markers: loadSeenSnapshotMarkers(storageKey) };
        }
      }

      window.addEventListener("local-storage", handleStorageEvent);
      window.addEventListener("storage", handleStorageEvent);

      onCleanup(function removeStorageListeners() {
        window.removeEventListener("local-storage", handleStorageEvent);
        window.removeEventListener("storage", handleStorageEvent);
      });
    },
    { immediate: true },
  );

  watch(
    function getClient() {
      return apiStore.client;
    },
    function resetSnapshots() {
      serverSnapshots.value = undefined;
    },
  );

  watch(
    [
      function getClient() {
        return apiStore.client;
      },
      groupName,
      seenSnapshotState,
    ],
    function fetchSnapshots([client, currentGroupName, currentSeenSnapshotState], _previousValues, onCleanup) {
      if (!client || !currentGroupName || currentSeenSnapshotState.groupName !== currentGroupName) {
        return;
      }

      let cancelled = false;
      onCleanup(function cancelSnapshotRequest() {
        cancelled = true;
      });

      client
        .fetchMemberSnapshots(currentSeenSnapshotState.markers)
        .then(function storeSnapshots(snapshots) {
          if (!cancelled) {
            serverSnapshots.value = snapshots;
          }
        })
        .catch(function reportSnapshotError(reason) {
          console.error("Failed to fetch member snapshots", reason);

          if (!cancelled) {
            serverSnapshots.value ??= new Map();
          }
        });
    },
    { immediate: true },
  );

  return { getBaselineSnapshot, clearBaselineSnapshot };
});
