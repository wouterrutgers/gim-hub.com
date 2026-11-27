<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { isRecentActivitySession } from "../../game/activity";
  import { useApiStore } from "../../stores/api";
  import { useActivityStore } from "../../stores/activity";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import CollectionLogWindow from "../collection-log/CollectionLogWindow.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import ActivityTimeline from "./ActivityTimeline.vue";
  import ActivityComparison from "./ActivityComparison.vue";
  import "./activity-feed.css";

  const props = defineProps({ collapsible: { type: Boolean, default: true } });
  const apiStore = useApiStore();
  const activityStore = useActivityStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const { open, componentProps, openModal, closeModal } = useModal();
  const scroller = ref();
  const earlierActivityMarker = ref();
  const comparisonScroller = ref();
  const excludedMembers = ref(new Set());
  const showTimeline = ref(false);
  const comparing = computed(function comparingPlayers() {
    return !props.collapsible && !showTimeline.value;
  });
  const typeFilter = ref("");
  const timestamp = ref(Date.now());
  const timer = window.setInterval(function updateClock() {
    timestamp.value = Date.now();
  }, 10_000);
  onBeforeUnmount(function stopClock() {
    window.clearInterval(timer);
  });

  function openCollectionLog(player, initialItemId) {
    openModal({ player, initialItemId });
  }

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
  const timelineRows = computed(function orderTimelineRows() {
    const recent = [];
    const history = [];

    for (const entry of filteredEntries.value) {
      const recentSession = isRecentActivitySession(entry, timestamp.value);
      const rows = recentSession ? recent : history;
      rows.push({ entry, recentSession });
    }

    return [...recent, ...history];
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

  watch(
    earlierActivityMarker,
    function observeEarlierActivity(marker, _previousMarker, onCleanup) {
      if (!marker) {
        return;
      }

      const observer = new IntersectionObserver(
        function loadWhenNearEnd([entry]) {
          if (entry.isIntersecting && earlierActivityMarker.value === marker) {
            void activityStore.loadOlder();
          }
        },
        { root: scroller.value, rootMargin: "0px 0px 200px" },
      );
      observer.observe(marker);
      onCleanup(function stopObserving() {
        observer.disconnect();
      });
    },
    { flush: "post" },
  );

  watch(timelineRows, async function preserveReadingPosition(rows, previous) {
    const timeline = scroller.value;

    if (!timeline || previous.length === 0) {
      return;
    }

    if (timeline.scrollTop <= 24) {
      await nextTick();
      timeline.scrollTop = 0;

      return;
    }

    const { top, bottom } = timeline.getBoundingClientRect();
    const previousSections = new Map(previous.map(({ entry, recentSession }) => [entry.id, recentSession]));
    const currentSections = new Map(rows.map(({ entry, recentSession }) => [entry.id, recentSession]));
    let firstVisible;
    const anchor =
      [...timeline.querySelectorAll("[data-entry-id]")].find(function staysInSection(element) {
        const bounds = element.getBoundingClientRect();

        if (bounds.bottom < top || bounds.top > bottom) {
          return false;
        }

        firstVisible ??= element;
        const identifier = Number(element.dataset.entryId);

        return currentSections.get(identifier) === previousSections.get(identifier);
      }) ?? firstVisible;

    if (!anchor) {
      return;
    }

    const selector = `[data-entry-id="${anchor.dataset.entryId}"]`;
    const offset = anchor.getBoundingClientRect().top - top;
    await nextTick();
    const moved = timeline.querySelector(selector);

    if (moved) {
      timeline.scrollTop += moved.getBoundingClientRect().top - top - offset;
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
    <Modal :open="open" :component="CollectionLogWindow" :component-props="componentProps" @close="closeModal" />
    <header class="activity-feed-header">
      <div>
        <component :is="props.collapsible ? 'h2' : 'h1'">Group activity</component>
        <span
          v-if="!comparing"
          class="activity-feed-period"
          tabindex="0"
          data-tooltip="Activity stays detailed for at least 30 days. Older completed weeks are combined per player, from Monday to Sunday in UTC."
          >{{ activityStore.olderCursor ? "Loaded history" : "All history" }}</span
        >
        <RouterLink
          v-if="props.collapsible"
          to="/group/activity"
          class="activity-page-link"
          @click="showTimeline = false"
        >
          Compare players <span class="chevron chevron-right" aria-hidden="true" />
        </RouterLink>
      </div>
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
      <div v-else class="activity-view-toggle" role="group" aria-label="Activity view">
        <button type="button" class="men-button" :aria-pressed="!comparing" @click="showTimeline = true">
          Timeline
        </button>
        <button type="button" class="men-button" :aria-pressed="comparing" @click="showTimeline = false">
          Compare
        </button>
      </div>
    </header>
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
    <div v-if="comparing" class="activity-player-buttons" role="group" aria-label="Select players to compare">
      <div class="activity-player-options">
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
          {{ name }}
        </button>
      </div>
    </div>
    <KeepAlive>
      <ActivityComparison
        v-if="comparing"
        ref="comparisonScroller"
        :players="comparisonPlayers"
        :filter-entry="matches"
        :period-label="periodLabel"
        @open-collection-log="openCollectionLog"
      />
    </KeepAlive>
    <div
      v-if="!comparing"
      ref="scroller"
      class="activity-feed-scroll"
      :role="props.collapsible ? undefined : 'region'"
      :aria-label="props.collapsible ? undefined : 'Group activity timeline'"
      :tabindex="props.collapsible ? undefined : 0"
    >
      <p v-if="!activityStore.loaded || !groupStore.loaded" class="activity-empty">Loading activity…</p>
      <p v-else-if="filteredEntries.length === 0 && !activityStore.olderCursor" class="activity-empty">
        {{ activityStore.entries.length === 0 ? "No activity yet." : "No activity matches these filters." }}
      </p>
      <ActivityTimeline
        :rows="timelineRows"
        :members="members"
        :timestamp="timestamp"
        @open-collection-log="openCollectionLog"
      />
      <p v-if="activityStore.loadingOlder" class="activity-empty" role="status">Loading earlier activity…</p>
      <button
        v-if="activityStore.olderError"
        type="button"
        class="activity-older men-button small"
        @click="activityStore.loadOlder"
      >
        Retry loading earlier activity
      </button>
      <div
        v-else-if="
          activityStore.olderCursor && groupStore.loaded && (!props.collapsible || settingsStore.showActivitySidebar)
        "
        :key="activityStore.olderCursor"
        ref="earlierActivityMarker"
        aria-hidden="true"
      />
    </div>
  </section>
</template>
