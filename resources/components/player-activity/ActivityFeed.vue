<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { useActivityStore } from "../../stores/activity";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { activityIsLive, activityPresentation } from "../../game/activity";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import "./activity-feed.css";

  const props = defineProps({
    collapsible: { type: Boolean, default: true },
  });

  const activityStore = useActivityStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const scroller = ref();
  const memberFilter = ref("");
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
  const filteredEntries = computed(function filterEntries() {
    return activityStore.entries.filter(function matches(entry) {
      return (
        members.value.has(entry.member_id) &&
        (!memberFilter.value || entry.member_id === memberFilter.value) &&
        (!settingsStore.filterActivityDrops || entry.type !== "collection") &&
        (!typeFilter.value ||
          entry.type === typeFilter.value ||
          (typeFilter.value === "loot" && entry.type === "collection"))
      );
    });
  });
  watch(members, function resetMissingMemberFilter(currentMembers) {
    if (memberFilter.value && !currentMembers.has(memberFilter.value)) {
      memberFilter.value = "";
    }
  });
  const presentations = computed(function getPresentations() {
    return new Map(
      filteredEntries.value.map(function present(entry) {
        return [entry.id, activityPresentation(entry, gameDataStore.gameData)];
      }),
    );
  });

  function dateLabel(entry) {
    const date = new Date(entry.started_at);

    if (entry.is_weekly) {
      return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    }

    const today = new Date(timestamp.value);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    today.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function relativeTime(entry) {
    if (entry.is_weekly) {
      return "Weekly summary";
    }

    const minutes = Math.max(0, Math.floor((timestamp.value - entry.started_at) / 60_000));

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}h ago`;
    }

    return `${Math.floor(minutes / 1440)}d ago`;
  }

  function entryClock(entry) {
    if (entry.is_weekly) {
      return "Week";
    }

    return new Date(entry.started_at).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }

  function timeRange(entry) {
    if (entry.is_weekly) {
      const options = { month: "short", day: "numeric", timeZone: "UTC" };

      return `${new Date(entry.started_at).toLocaleDateString(undefined, options)} to ${new Date(entry.started_at + 6 * 24 * 60 * 60_000).toLocaleDateString(undefined, options)}`;
    }

    const start = new Date(entry.started_at).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const end = activityIsLive(entry, timestamp.value)
      ? "now"
      : new Date(entry.occurred_at).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });

    return entry.started_at === entry.occurred_at && !activityIsLive(entry, timestamp.value)
      ? start
      : `${start} to ${end}`;
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

    const following = scroller.value.scrollTop <= 24;

    if (following) {
      await nextTick();
      scroller.value.scrollTop = 0;

      return;
    }

    const top = scroller.value.getBoundingClientRect().top;
    const anchor = [...scroller.value.querySelectorAll("[data-entry-id]")].find(function visible(element) {
      return element.getBoundingClientRect().bottom >= top;
    });

    if (!anchor) {
      return;
    }

    const identifier = anchor.dataset.entryId;
    const offset = anchor.getBoundingClientRect().top - top;
    await nextTick();
    const moved = scroller.value.querySelector(`[data-entry-id="${identifier}"]`);

    if (moved) {
      scroller.value.scrollTop += moved.getBoundingClientRect().top - top - offset;
    }
  });

  watch(
    [
      memberFilter,
      typeFilter,
      function getDropFilter() {
        return settingsStore.filterActivityDrops;
      },
    ],
    function resetFilters() {
      scroller.value.scrollTop = 0;
    },
  );
</script>

<template>
  <section class="activity-feed rsborder rsbackground" aria-label="Group activity timeline">
    <header class="activity-feed-header">
      <h2>Group activity</h2>
      <span
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
        aria-label="Collapse activity timeline"
        data-tooltip="Collapse activity timeline"
        aria-controls="group-activity-sidebar"
        @click="settingsStore.setShowActivitySidebar(false)"
      >
        <span class="chevron chevron-right" aria-hidden="true" />
      </button>
    </header>
    <div class="activity-feed-filters">
      <span class="select-container">
        <select v-model="memberFilter" aria-label="Filter activity by player">
          <option value="">Everyone</option>
          <option v-for="[identifier, name] in members" :key="identifier" :value="identifier">{{ name }}</option>
        </select>
      </span>
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
    <div ref="scroller" class="activity-feed-scroll" @scroll="onScroll">
      <p v-if="!activityStore.loaded || !groupStore.loaded" class="activity-empty">Loading activity…</p>
      <p v-else-if="filteredEntries.length === 0" class="activity-empty">
        {{
          activityStore.entries.length
            ? activityStore.olderCursor
              ? "No matches in loaded history. Load earlier activity to search further."
              : "No activity matches these filters."
            : "No activity yet."
        }}
      </p>
      <ol class="activity-timeline">
        <li v-for="(entry, index) in filteredEntries" :key="entry.id" :data-entry-id="entry.id">
          <h3 v-if="index === 0 || dateLabel(entry) !== dateLabel(filteredEntries[index - 1])" class="activity-date">
            {{ dateLabel(entry) }}
          </h3>
          <article :class="['activity-card', { 'activity-milestone': presentations.get(entry.id).milestone }]">
            <time
              class="activity-time"
              :datetime="new Date(entry.started_at).toISOString()"
              :title="
                entry.is_weekly
                  ? `${timeRange(entry)} (UTC)`
                  : `${relativeTime(entry)} (${new Date(entry.started_at).toLocaleString()})`
              "
              >{{ entryClock(entry) }}</time
            >
            <div class="activity-card-content">
              <span class="activity-card-player">
                <PlayerIcon :name="members.get(entry.member_id)" />
                <strong>{{ members.get(entry.member_id) }}</strong
                >:
              </span>
              <span class="activity-card-event">{{ presentations.get(entry.id).text }}</span>
              <CachedImage
                v-if="presentations.get(entry.id).milestone"
                class="activity-icon"
                :src="presentations.get(entry.id).icon"
                alt=""
                width="16"
                height="16"
              />
              <span v-if="activityIsLive(entry, timestamp)" class="activity-live">Live</span>
              <span v-if="presentations.get(entry.id).collectionUnlock" class="activity-unlock"
                >New collection item</span
              >
              <details v-if="presentations.get(entry.id).details.length" class="activity-card-details">
                <summary><span class="chevron chevron-right" aria-hidden="true" /><span>Details</span></summary>
                <p class="activity-detail-range">{{ timeRange(entry) }}{{ entry.is_weekly ? " (UTC)" : "" }}</p>
                <ul>
                  <li v-for="detail in presentations.get(entry.id).details" :key="detail">
                    <span class="activity-detail-content">
                      <span v-if="entry.type === 'level'">Level {{ entry.data.before }} to {{ entry.data.after }}</span>
                      <span v-else>{{ detail }}</span>
                    </span>
                  </li>
                </ul>
              </details>
            </div>
          </article>
        </li>
      </ol>
      <button
        v-if="activityStore.olderCursor"
        class="activity-older men-button small"
        :disabled="activityStore.loadingOlder"
        @click="activityStore.loadOlder"
      >
        {{ activityStore.loadingOlder ? "Loading…" : "Load earlier activity" }}
      </button>
    </div>
  </section>
</template>
