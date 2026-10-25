import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";
import { activityWeek } from "../game/activity";

export const useActivityStore = defineStore("activity", function createActivityStore() {
  const apiStore = useApiStore();
  const records = shallowRef(new Map());
  const loaded = ref(false);
  const olderCursor = ref();
  const loadingOlder = ref(false);
  const entries = computed(function sortedEntries() {
    return [...records.value.values()].sort(function chronologicalOrder(left, right) {
      return right.started_at - left.started_at || right.id - left.id;
    });
  });

  function mergeEntries(updates) {
    const next = new Map(records.value);

    for (const entry of updates) {
      const previous = next.get(entry.id);

      if (!previous || entry.revision >= previous.revision) {
        next.set(entry.id, entry);
      }
    }

    const archivedWeeks = new Set(
      [...next.values()]
        .filter(function weekly(entry) {
          return entry.is_weekly;
        })
        .map(function week(entry) {
          return `${entry.member_id}:${entry.started_at}`;
        }),
    );

    for (const [identifier, entry] of next) {
      if (!entry.is_weekly && archivedWeeks.has(`${entry.member_id}:${activityWeek(entry.occurred_at)}`)) {
        next.delete(identifier);
      }
    }

    records.value = next;
  }

  async function loadOlder() {
    if (!olderCursor.value || loadingOlder.value) {
      return;
    }

    const client = apiStore.client;
    loadingOlder.value = true;

    try {
      const response = await client.fetchActivity({ cursor: olderCursor.value });

      if (apiStore.client !== client) {
        return;
      }

      mergeEntries(response.entries);
      olderCursor.value = response.older_cursor;
    } catch (reason) {
      console.error("Failed to fetch earlier group activity", reason);
    } finally {
      if (apiStore.client === client) {
        loadingOlder.value = false;
      }
    }
  }

  watch(
    function getClient() {
      return apiStore.client;
    },
    function connect(client, _previous, onCleanup) {
      records.value = new Map();
      loaded.value = false;
      olderCursor.value = undefined;
      loadingOlder.value = false;

      if (!client) {
        return;
      }

      let cancelled = false;
      let timeout;
      let fromTime;
      async function poll() {
        try {
          const response = await client.fetchActivity({ fromTime });

          if (cancelled) {
            return;
          }

          mergeEntries(response.entries);

          if (!fromTime) {
            olderCursor.value = response.older_cursor;
          }

          fromTime = response.from_time;
          loaded.value = true;
        } catch (reason) {
          console.error("Failed to fetch group activity", reason);
        }

        if (!cancelled) {
          timeout = window.setTimeout(poll, 5000);
        }
      }
      void poll();
      onCleanup(function disconnect() {
        cancelled = true;
        window.clearTimeout(timeout);
      });
    },
    { immediate: true },
  );

  return {
    entries,
    loaded,
    olderCursor,
    loadingOlder,
    mergeEntries,
    loadOlder,
  };
});
