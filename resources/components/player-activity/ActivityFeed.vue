<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useActivityStore } from "../../stores/activity";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import ActivityTimeline from "./ActivityTimeline.vue";
  import ActivityComparison from "./ActivityComparison.vue";
  import "./activity-feed.css";

  const props = defineProps({ collapsible: { type: Boolean, default: true } });
  const apiStore = useApiStore();
  const activityStore = useActivityStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const scroller = ref();
  const comparisonScroller = ref();
  const excludedMembers = ref(new Set());
  const comparing = computed(function comparingPlayers() {
    return !props.collapsible;
  });
  const typeFilter = ref("");
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
  watch(members, function removeMissingComparisonPlayers(currentMembers) {
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

  function selectMember(identifier) {
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
    return activityStore.entries.filter(matches);
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
      void activityStore.loadOlder();
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
    const anchor = [...scroller.value.querySelectorAll("[data-entry-id]")].find(function visible(element) {
      const bounds = element.getBoundingClientRect();

      return bounds.bottom >= top && bounds.top <= bottom;
    });

    if (!anchor) {
      return;
    }

    const selector = `[data-entry-id="${anchor.dataset.entryId}"]`;
    const offset = anchor.getBoundingClientRect().top - top;
    await nextTick();
    const moved = scroller.value.querySelector(selector);

    if (moved) {
      scroller.value.scrollTop += moved.getBoundingClientRect().top - top - offset;
    }
  });

  watch(
    [
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
        >{{ activityStore.olderCursor ? "Loaded history" : "All history" }}</span
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
    <div v-if="comparing" class="activity-player-buttons" role="group" aria-label="Select players to compare">
      <span class="activity-selection-label">Select players to compare</span>
      <button
        type="button"
        class="men-button small"
        :class="{ active: excludedMembers.size === 0 }"
        :aria-pressed="excludedMembers.size === 0"
        @click="excludedMembers.clear()"
      >
        Everyone
      </button>
      <button
        v-for="[identifier, name] in members"
        :key="identifier"
        type="button"
        class="men-button small"
        :class="{ active: !excludedMembers.has(identifier) }"
        :aria-pressed="!excludedMembers.has(identifier)"
        @click="selectMember(identifier)"
      >
        <span class="activity-player-check" aria-hidden="true">{{ excludedMembers.has(identifier) ? "" : "✓" }}</span>
        <PlayerIcon :name="name" />{{ name }}
      </button>
    </div>
    <RouterLink v-else to="/group/activity" class="activity-page-link men-button small">Compare players</RouterLink>
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
      <p v-if="!activityStore.loaded || !groupStore.loaded" class="activity-empty">Loading activity…</p>
      <p v-else-if="filteredEntries.length === 0" class="activity-empty">
        {{
          activityStore.entries.length === 0
            ? "No activity yet."
            : activityStore.olderCursor
              ? "No matches in loaded history. Load earlier activity to search further."
              : "No activity matches these filters."
        }}
      </p>
      <ActivityTimeline :entries="filteredEntries" :members="members" :timestamp="timestamp" />
      <button
        v-if="activityStore.olderCursor"
        type="button"
        class="activity-older men-button small"
        :disabled="activityStore.loadingOlder"
        @click="activityStore.loadOlder"
      >
        {{ activityStore.loadingOlder ? "Loading…" : "Load earlier activity" }}
      </button>
    </div>
  </section>
</template>
