<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useActivityStore } from "../../stores/activity";
  import { usePlayerActivityStore } from "../../stores/player-activity";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { summarizeActivity } from "../../game/activity-summary";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import ActivityTimeline from "./ActivityTimeline.vue";
  import ActivityComparison from "./ActivityComparison.vue";
  import "./activity-feed.css";

  const props = defineProps({ collapsible: { type: Boolean, default: true } });
  const apiStore = useApiStore();
  const activityStore = useActivityStore();
  const playerActivityStore = usePlayerActivityStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const scroller = ref();
  const comparisonScroller = ref();
  const comparison = ref(false);
  const excludedMembers = ref(new Set());
  const comparing = computed(function comparingPlayers() {
    return !props.collapsible && comparison.value;
  });
  const typeFilter = ref("");
  const memberFilter = computed({
    get() {
      return playerActivityStore.selectedMember;
    },
    set(value) {
      playerActivityStore.selectedMember = value;
    },
  });
  const currentStore = computed(function currentActivity() {
    return memberFilter.value ? playerActivityStore : activityStore;
  });
  const timestamp = ref(Date.now());
  const timer = window.setInterval(function updateClock() {
    timestamp.value = Date.now();
  }, 10_000);
  onBeforeUnmount(function stopClock() {
    window.clearInterval(timer);
  });

  const members = computed(function getMembers() {
    return new Map(
      [...groupStore.memberStates]
        .filter(function player([name]) {
          return name !== "@SHARED";
        })
        .map(function memberIdentity([name, member]) {
          return [member.id, name];
        }),
    );
  });
  watch(members, function resetMissingMemberFilter(currentMembers) {
    if (memberFilter.value && !currentMembers.has(memberFilter.value)) {
      memberFilter.value = "";
    }

    for (const identifier of excludedMembers.value) {
      if (!currentMembers.has(identifier)) {
        excludedMembers.value.delete(identifier);
      }
    }
  });
  const comparisonPlayers = computed(function selectedComparisonPlayers() {
    return [...members.value]
      .filter(function included([identifier]) {
        return !excludedMembers.value.has(identifier);
      })
      .map(function player([identifier, name]) {
        return { identifier, name };
      });
  });

  function selectEveryone() {
    if (comparing.value) {
      excludedMembers.value.clear();

      return;
    }

    memberFilter.value = "";
  }

  function selectMember(identifier) {
    if (!comparing.value) {
      memberFilter.value = identifier;

      return;
    }

    if (excludedMembers.value.has(identifier)) {
      excludedMembers.value.delete(identifier);

      return;
    }

    excludedMembers.value.add(identifier);
  }

  function matches(entry) {
    return (
      members.value.has(entry.member_id) &&
      (!settingsStore.filterActivityDrops || entry.type !== "collection") &&
      (!typeFilter.value ||
        entry.type === typeFilter.value ||
        (typeFilter.value === "loot" && entry.type === "collection"))
    );
  }

  const filteredEntries = computed(function filterEntries() {
    const entries = memberFilter.value
      ? playerActivityStore.periods.flatMap(function periodEntries(period) {
          return period.entries;
        })
      : activityStore.entries;

    return entries.filter(matches);
  });
  const periods = computed(function summarizePeriods() {
    return playerActivityStore.periods
      .map(function summarize(period) {
        const entries = period.entries.filter(matches);

        return { ...period, entries, summary: summarizeActivity(entries, gameDataStore.gameData) };
      })
      .filter(function hasActivity(period) {
        return period.entries.length > 0;
      });
  });

  function periodLabel(period) {
    const date = new Date(period.started_at);

    if (period.kind === "week") {
      return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} (UTC)`;
    }

    const today = new Date(timestamp.value);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    today.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function onScroll() {
    if (scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight <= 200) {
      void currentStore.value.loadOlder();
    }
  }

  watch(filteredEntries, async function preserveReadingPosition(_entries, previous) {
    if (!scroller.value || previous.length === 0) {
      return;
    }

    if (scroller.value.scrollTop <= 24) {
      await nextTick();
      scroller.value.scrollTop = 0;

      return;
    }

    const { top, bottom } = scroller.value.getBoundingClientRect();
    const anchor = [
      ...scroller.value.querySelectorAll(memberFilter.value ? "[data-period-key]" : "[data-entry-id]"),
    ].find(function visible(element) {
      const bounds = element.getBoundingClientRect();

      return bounds.bottom >= top && bounds.top <= bottom;
    });

    if (!anchor) {
      return;
    }

    const selector = memberFilter.value
      ? `[data-period-key="${anchor.dataset.periodKey}"]`
      : `[data-entry-id="${anchor.dataset.entryId}"]`;
    const offset = anchor.getBoundingClientRect().top - top;
    await nextTick();
    const moved = scroller.value.querySelector(selector);

    if (moved) {
      scroller.value.scrollTop += moved.getBoundingClientRect().top - top - offset;
    }
  });

  watch(
    [
      memberFilter,
      typeFilter,
      comparing,
      function selectedComparisonPlayers() {
        return comparisonPlayers.value
          .map(function identifier(player) {
            return player.identifier;
          })
          .join(",");
      },
      function getDropFilter() {
        return settingsStore.filterActivityDrops;
      },
      function getClient() {
        return apiStore.client;
      },
    ],
    function resetView() {
      const element = comparing.value ? comparisonScroller.value?.$el : scroller.value;

      if (element) {
        element.scrollTop = 0;
      }
    },
    { flush: "sync" },
  );
</script>

<template>
  <section
    class="activity-feed rsborder rsbackground"
    :class="{ 'activity-comparison-feed': comparing }"
    aria-label="Group activity"
  >
    <header class="activity-feed-header">
      <h2>Group activity</h2>
      <span
        v-if="!comparing"
        class="activity-feed-period"
        tabindex="0"
        data-tooltip="Activity stays detailed for at least 30 days. Older completed weeks are combined per player, from Monday to Sunday in UTC."
        >{{ currentStore.olderCursor ? "Loaded history" : "All history" }}</span
      >
      <button
        v-if="props.collapsible"
        class="activity-collapse"
        type="button"
        :aria-expanded="settingsStore.showActivitySidebar"
        aria-label="Close activity sidebar"
        data-tooltip="Close activity sidebar"
        aria-controls="group-activity-sidebar"
        @click="settingsStore.setShowActivitySidebar(false)"
      >
        <span class="chevron chevron-right" aria-hidden="true" />
      </button>
    </header>
    <div v-if="!props.collapsible" class="activity-display-switch" role="group" aria-label="Activity display">
      <button
        type="button"
        class="men-button small"
        :class="{ active: !comparison }"
        :aria-pressed="!comparison"
        @click="comparison = false"
      >
        Activity
      </button>
      <button
        type="button"
        class="men-button small"
        :class="{ active: comparison }"
        :aria-pressed="comparison"
        @click="comparison = true"
      >
        Compare
      </button>
    </div>
    <div class="activity-player-buttons" role="group" aria-label="Filter activity by player">
      <button
        type="button"
        class="men-button small"
        :class="{ active: comparing ? excludedMembers.size === 0 : !memberFilter }"
        :aria-pressed="comparing ? excludedMembers.size === 0 : !memberFilter"
        @click="selectEveryone"
      >
        Everyone
      </button>
      <button
        v-for="[identifier, name] in members"
        :key="identifier"
        type="button"
        class="men-button small"
        :class="{ active: comparing ? !excludedMembers.has(identifier) : memberFilter === identifier }"
        :aria-pressed="comparing ? !excludedMembers.has(identifier) : memberFilter === identifier"
        @click="selectMember(identifier)"
      >
        <PlayerIcon :name="name" />{{ name }}
      </button>
    </div>
    <div class="activity-feed-filters">
      <span class="select-container">
        <select v-model="typeFilter" aria-label="Filter activity by type">
          <option value="">All activity</option>
          <option value="xp">XP</option>
          <option value="level">Levels</option>
          <option value="boss">Boss kills</option>
          <option value="quest">Quests</option>
          <option value="diary">Diaries</option>
          <option value="loot">Drops</option>
        </select>
      </span>
      <div
        class="activity-drop-filter"
        data-tooltip="Only show drops worth at least 1m GP or new collection log unlocks. Other activity is always shown."
      >
        <input
          id="filter-activity-drops-input"
          type="checkbox"
          :checked="settingsStore.filterActivityDrops"
          @change="settingsStore.setFilterActivityDrops($event.target.checked)"
        />
        <label for="filter-activity-drops-input"><span>Filter drops</span></label>
      </div>
    </div>
    <ActivityComparison
      v-if="comparing"
      ref="comparisonScroller"
      :players="comparisonPlayers"
      :filter-entry="matches"
      :period-label="periodLabel"
    />
    <div v-else ref="scroller" class="activity-feed-scroll" @scroll="onScroll">
      <p v-if="memberFilter && playerActivityStore.error" class="activity-error" role="status">
        {{ playerActivityStore.error }}
      </p>
      <p
        v-if="(!currentStore.loaded || !groupStore.loaded) && !(memberFilter && playerActivityStore.error)"
        class="activity-empty"
      >
        Loading activity…
      </p>
      <p v-else-if="currentStore.loaded && filteredEntries.length === 0" class="activity-empty">
        {{
          !memberFilter && activityStore.entries.length === 0
            ? "No activity yet."
            : currentStore.olderCursor
              ? "No matches in loaded history. Load earlier activity to search further."
              : "No activity matches these filters."
        }}
      </p>
      <template v-if="memberFilter">
        <section v-for="period in periods" :key="period.key" :data-period-key="period.key" class="activity-day">
          <h3 class="activity-date">{{ periodLabel(period) }}</h3>
          <div v-for="[label, rows] in period.summary" :key="label" class="activity-summary-category">
            <h4>{{ label }}</h4>
            <ul>
              <li v-for="row in rows" :key="row.text">
                <CachedImage
                  v-if="row.icon"
                  class="activity-detail-icon"
                  :src="row.icon"
                  alt=""
                  width="16"
                  height="16"
                />{{ row.text }}
              </li>
            </ul>
          </div>
        </section>
      </template>
      <ActivityTimeline v-else :entries="filteredEntries" :members="members" :timestamp="timestamp" />
      <button
        v-if="currentStore.olderCursor"
        type="button"
        class="activity-older men-button small"
        :disabled="currentStore.loadingOlder"
        @click="currentStore.loadOlder"
      >
        {{ currentStore.loadingOlder ? "Loading…" : "Load earlier activity" }}
      </button>
    </div>
  </section>
</template>
