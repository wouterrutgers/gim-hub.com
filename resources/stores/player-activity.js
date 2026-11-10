import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useApiStore } from "./api";
import { activityWeek } from "../game/activity";

export const usePlayerActivityStore = defineStore("player-activity", function createPlayerActivityStore() {
  return createPlayerActivityHistory(ref(""));
});

export function createPlayerActivityHistory(selectedMember) {
  const apiStore = useApiStore();
  const records = shallowRef(new Map());
  const loaded = ref(false);
  const error = ref("");
  const olderCursor = ref(null);
  const loadingOlder = ref(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let connection;
  const periods = computed(function sortedPeriods() {
    return [...records.value.values()].sort(function newestFirst(left, right) {
      return right.started_at - left.started_at || right.kind.localeCompare(left.kind);
    });
  });

  function mergePeriods(response) {
    const next = new Map(records.value);
    const watermark = Date.parse(response.from_time);

    for (const period of response.periods) {
      const previous = next.get(period.key);

      if (previous && previous.watermark > watermark) {
        continue;
      }

      const revisions = new Map(
        previous?.entries.map(function recordedEntry(entry) {
          return [entry.id, entry];
        }),
      );
      const entries = period.entries.map(function latestRevision(entry) {
        const recorded = revisions.get(entry.id);

        return recorded && recorded.revision > entry.revision ? recorded : entry;
      });
      next.set(period.key, { ...period, entries, watermark });
    }

    const archivedWeeks = new Set(
      [...next.values()]
        .filter(function weekly(period) {
          return period.kind === "week";
        })
        .map(function week(period) {
          return period.started_at;
        }),
    );

    for (const [key, period] of next) {
      if (period.kind === "week") {
        continue;
      }

      const entries = period.entries.filter(function retained(entry) {
        return !archivedWeeks.has(activityWeek(entry.occurred_at));
      });

      if (entries.length === 0) {
        next.delete(key);

        continue;
      }

      next.set(key, { ...period, entries });
    }

    records.value = next;
  }

  async function loadOlder() {
    if (!olderCursor.value || loadingOlder.value) {
      return;
    }

    const current = connection;
    loadingOlder.value = true;

    try {
      const response = await current.client.fetchPlayerActivity({
        memberIdentifier: current.member,
        timezone,
        cursor: olderCursor.value,
      });

      if (current !== connection) {
        return;
      }

      mergePeriods(response);
      olderCursor.value = response.older_cursor;
      error.value = "";
    } catch (reason) {
      if (current === connection) {
        error.value = "Could not load earlier player activity. Please try again.";
      }

      console.error("Failed to fetch earlier player activity", reason);
    } finally {
      if (current === connection) {
        loadingOlder.value = false;
      }
    }
  }

  watch(
    [
      function getClient() {
        return apiStore.client;
      },
      selectedMember,
    ],
    function connect([client, member], _previous, onCleanup) {
      const current = { client, member };
      connection = current;
      records.value = new Map();
      loaded.value = false;
      error.value = "";
      olderCursor.value = null;
      loadingOlder.value = false;

      if (!client || !member) {
        return;
      }

      let timeout;
      let fromTime;

      async function poll() {
        try {
          const response = await client.fetchPlayerActivity({ memberIdentifier: member, timezone, fromTime });

          if (connection !== current) {
            return;
          }

          mergePeriods(response);

          if (!fromTime) {
            olderCursor.value = response.older_cursor;
          }

          fromTime = response.from_time;
          loaded.value = true;
          error.value = "";
        } catch (reason) {
          if (connection === current) {
            error.value = "Could not load player activity. Retrying…";
          }

          console.error("Failed to fetch player activity", reason);
        }

        if (connection === current) {
          timeout = window.setTimeout(poll, 5000);
        }
      }

      void poll();
      onCleanup(function disconnect() {
        window.clearTimeout(timeout);
        connection = undefined;
      });
    },
    { flush: "sync", immediate: true },
  );

  return { selectedMember, periods, loaded, error, olderCursor, loadingOlder, loadOlder };
}
