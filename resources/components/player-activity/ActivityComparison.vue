<script setup>
  import { computed, effectScope, onBeforeUnmount, reactive, ref, shallowRef, watch, watchEffect } from "vue";
  import { createPlayerActivityHistory } from "../../stores/player-activity";
  import { useGameDataStore } from "../../stores/game-data";
  import { activityComparisonRows, playerPeriodIsLoaded, playerPeriodStatus } from "../../game/activity-comparison";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";

  const props = defineProps({
    players: { type: Array, required: true },
    filterEntry: { type: Function, required: true },
    periodLabel: { type: Function, required: true },
  });
  const gameDataStore = useGameDataStore();
  const sources = shallowRef(new Map());
  const visibleThrough = shallowRef();

  watch(
    function selectedPlayers() {
      return props.players;
    },
    function synchronizePlayers(players) {
      const next = new Map(sources.value);

      for (const [identifier, source] of next) {
        if (
          !players.some(function selected(player) {
            return player.identifier === identifier;
          })
        ) {
          source.scope.stop();
          next.delete(identifier);
        }
      }

      for (const player of players) {
        if (next.has(player.identifier)) {
          continue;
        }

        visibleThrough.value = undefined;
        const scope = effectScope();
        const history = scope.run(function startHistory() {
          return reactive(createPlayerActivityHistory(ref(player.identifier)));
        });
        next.set(player.identifier, { scope, history });
      }

      sources.value = next;
    },
    { immediate: true },
  );

  onBeforeUnmount(function stopHistories() {
    for (const source of sources.value.values()) {
      source.scope.stop();
    }
  });

  const allPeriods = computed(function comparePeriods() {
    const combined = new Map();

    for (const player of props.players) {
      for (const period of sources.value.get(player.identifier).history.periods) {
        if (!combined.has(period.key)) {
          combined.set(period.key, { ...period, rows: new Map() });
        }

        const target = combined.get(period.key);
        const entries = period.entries.filter(props.filterEntry);

        for (const row of activityComparisonRows(entries, gameDataStore.gameData)) {
          if (!target.rows.has(row.key)) {
            target.rows.set(row.key, { ...row, values: new Map() });
          }

          target.rows.get(row.key).values.set(player.identifier, row.value);
        }
      }
    }

    const categories = ["Skills", "Boss kills", "Quests", "Achievement diaries", "Drops"];

    return [...combined.values()]
      .filter(function hasRows(period) {
        return period.rows.size > 0;
      })
      .sort(function newestFirst(left, right) {
        return right.started_at - left.started_at || right.kind.localeCompare(left.kind);
      })
      .map(function groupRows(period) {
        return {
          ...period,
          categories: categories
            .map(function categoryRows(label) {
              return [
                label,
                [...period.rows.values()]
                  .filter(function belongs(row) {
                    return row.category === label;
                  })
                  .sort(function alphabetical(left, right) {
                    return left.key === "xp:total"
                      ? -1
                      : right.key === "xp:total"
                        ? 1
                        : left.label.localeCompare(right.label);
                  }),
              ];
            })
            .filter(function hasRows([_label, rows]) {
              return rows.length > 0;
            }),
        };
      });
  });
  const periods = computed(function visiblePeriods() {
    return allPeriods.value.filter(function inVisibleRange(period) {
      return (
        !visibleThrough.value ||
        period.started_at > visibleThrough.value.started_at ||
        (period.started_at === visibleThrough.value.started_at && period.kind >= visibleThrough.value.kind)
      );
    });
  });
  const loading = computed(function loadingPlayers() {
    return [...sources.value.values()].some(function pending(source) {
      return !source.history.loaded && !source.history.error;
    });
  });
  const hasOlder = computed(function earlierHistory() {
    return (
      allPeriods.value.length > periods.value.length ||
      [...sources.value.values()].some(function earlier(source) {
        return source.history.olderCursor;
      })
    );
  });
  const loadingOlder = computed(function fetchingHistory() {
    return [...sources.value.values()].some(function fetching(source) {
      return source.history.loadingOlder;
    });
  });

  watchEffect(function loadMissingHistory() {
    if (loading.value || loadingOlder.value || allPeriods.value.length === 0) {
      return;
    }

    visibleThrough.value ??= allPeriods.value.at(-1);
    const oldest = periods.value.at(-1);

    if (!oldest) {
      return;
    }

    for (const { history } of sources.value.values()) {
      if (!history.error && !playerPeriodIsLoaded(history, oldest)) {
        void history.loadOlder();
      }
    }
  });

  async function loadOlder() {
    if (loadingOlder.value || !hasOlder.value) {
      return;
    }

    visibleThrough.value = undefined;
    await Promise.all(
      [...sources.value.values()].map(function earlier(source) {
        return source.history.loadOlder();
      }),
    );
  }

  function onScroll(event) {
    const scroller = event.currentTarget;

    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 200) {
      void loadOlder();
    }
  }
</script>

<template>
  <div
    class="activity-comparison-scroll"
    role="region"
    aria-label="Player activity comparison"
    tabindex="0"
    @scroll="onScroll"
  >
    <p v-if="props.players.length === 0" class="activity-empty">Select players to compare.</p>
    <p v-else-if="loading" class="activity-empty" role="status">Loading player activity…</p>
    <p v-else-if="periods.length === 0" class="activity-empty">No activity matches these filters.</p>
    <p
      v-for="player in props.players.filter(function failed(player) {
        return sources.get(player.identifier).history.error;
      })"
      :key="player.identifier"
      class="activity-error"
      role="status"
    >
      {{ player.name }}: {{ sources.get(player.identifier).history.error }}
    </p>
    <table
      v-if="props.players.length"
      class="activity-comparison-table"
      :style="{ '--comparison-player-count': props.players.length }"
    >
      <thead>
        <tr>
          <th scope="col">Activity</th>
          <th v-for="player in props.players" :key="player.identifier" scope="col">
            <PlayerIcon :name="player.name" />{{ player.name }}
          </th>
        </tr>
      </thead>
      <tbody v-for="period in periods" :key="period.key" :data-period-key="period.key">
        <tr class="activity-comparison-period">
          <th :colspan="props.players.length + 1" scope="rowgroup">
            <span class="activity-comparison-heading">{{ props.periodLabel(period) }}</span>
          </th>
        </tr>
        <template v-for="[label, rows] in period.categories" :key="label">
          <tr class="activity-comparison-category">
            <th :colspan="props.players.length + 1">
              <span class="activity-comparison-heading">{{ label }}</span>
            </th>
          </tr>
          <tr v-for="row in rows" :key="row.key" :class="{ 'activity-comparison-total': row.key === 'xp:total' }">
            <th scope="row">
              <CachedImage
                v-if="row.icon"
                class="activity-detail-icon"
                :src="row.icon"
                alt=""
                width="16"
                height="16"
              />{{ row.label }}
            </th>
            <td
              v-for="player in props.players"
              :key="player.identifier"
              :class="{ 'activity-comparison-empty': !row.values.has(player.identifier) }"
              :aria-label="
                !row.values.has(player.identifier) &&
                playerPeriodIsLoaded(sources.get(player.identifier).history, period)
                  ? 'No recorded activity'
                  : undefined
              "
            >
              {{
                row.values.get(player.identifier) ?? playerPeriodStatus(sources.get(player.identifier).history, period)
              }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <button
      v-if="hasOlder"
      type="button"
      class="activity-older men-button small"
      :disabled="loadingOlder"
      @click="loadOlder"
    >
      {{ loadingOlder ? "Loading…" : "Load earlier activity" }}
    </button>
  </div>
</template>
