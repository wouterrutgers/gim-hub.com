<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { useActivityStore } from "../../stores/activity";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { activityIsLive, activityPresentation } from "../../game/activity";
  import { skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import "./activity-feed.css";

  const activityStore = useActivityStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const scroller = ref();
  const memberFilter = ref("");
  const typeFilter = ref("");
  const newEntries = ref(0);
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
        (!typeFilter.value || entry.type === typeFilter.value)
      );
    });
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
    const today = new Date(timestamp.value);
    if (date.toDateString() === today.toDateString()) return "Today";
    today.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function relativeTime(entry) {
    const minutes = Math.max(0, Math.floor((timestamp.value - entry.started_at) / 60_000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  }

  function timeRange(entry) {
    const start = new Date(entry.started_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const end = activityIsLive(entry, timestamp.value)
      ? "now"
      : new Date(entry.occurred_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return entry.started_at === entry.occurred_at && !activityIsLive(entry, timestamp.value)
      ? start
      : `${start} to ${end}`;
  }

  function followLatest() {
    scroller.value.scrollTop = 0;
    newEntries.value = 0;
  }

  function onScroll() {
    if (scroller.value.scrollTop <= 24) newEntries.value = 0;
    if (scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight <= 200) {
      void activityStore.loadOlder();
    }
  }

  watch(filteredEntries, async function preserveReadingPosition(entries, previous) {
    if (!scroller.value || previous.length === 0) return;
    const known = new Set(
      previous.map(function identifier(entry) {
        return entry.id;
      }),
    );
    const added = entries.filter(function isNew(entry) {
      return !known.has(entry.id) && entry.started_at >= previous[0].started_at;
    }).length;
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
    if (!anchor) return;
    const identifier = anchor.dataset.entryId;
    const offset = anchor.getBoundingClientRect().top - top;
    newEntries.value += added;
    await nextTick();
    const moved = scroller.value.querySelector(`[data-entry-id="${identifier}"]`);
    if (moved) scroller.value.scrollTop += moved.getBoundingClientRect().top - top - offset;
  });

  watch([memberFilter, typeFilter], function resetFilters() {
    newEntries.value = 0;
    scroller.value.scrollTop = 0;
  });
</script>

<template>
  <section class="activity-feed rsborder rsbackground" aria-label="Group activity timeline">
    <header class="activity-feed-header">
      <div class="activity-feed-title">
        <span class="activity-status-light" :class="{ 'activity-status-offline': activityStore.error }" />
        <h2>Group activity</h2>
      </div>
      <span class="activity-feed-status">{{ activityStore.error ? "Reconnecting" : "30 days of adventures" }}</span>
      <button
        class="activity-collapse"
        type="button"
        :aria-expanded="settingsStore.showActivitySidebar"
        aria-label="Collapse activity timeline"
        data-tooltip="Collapse activity timeline"
        aria-controls="group-activity-sidebar"
        @click="settingsStore.setShowActivitySidebar(false)"
      >
        <span class="activity-toggle-chevron" aria-hidden="true" />
      </button>
    </header>
    <div class="activity-feed-filters">
      <select v-model="memberFilter" aria-label="Filter activity by player">
        <option value="">Everyone</option>
        <option v-for="[identifier, name] in members" :key="identifier" :value="identifier">{{ name }}</option>
      </select>
      <select v-model="typeFilter" aria-label="Filter activity by type">
        <option value="">All activity</option>
        <option value="xp">XP</option>
        <option value="level">Levels</option>
        <option value="boss">Boss kills</option>
        <option value="quest">Quests</option>
        <option value="diary">Diaries</option>
        <option value="loot">Drops and unlocks</option>
        <option value="collection">Repeat collection items</option>
      </select>
    </div>
    <button v-if="newEntries" class="activity-new-button men-button small" @click="followLatest">
      {{ newEntries }} new {{ newEntries === 1 ? "entry" : "entries" }} · Jump to latest
    </button>
    <div ref="scroller" class="activity-feed-scroll" @scroll="onScroll">
      <p v-if="!activityStore.loaded || !groupStore.loaded" class="activity-empty">
        {{ activityStore.error ?? "Loading your group’s adventures…" }}
      </p>
      <p v-else-if="filteredEntries.length === 0" class="activity-empty">
        {{
          activityStore.entries.length
            ? "No activity matches these filters."
            : "Your group’s story starts here. Activity appears as members play with the updated GIM Hub plugin."
        }}
      </p>
      <ol class="activity-timeline">
        <li v-for="(entry, index) in filteredEntries" :key="entry.id" :data-entry-id="entry.id">
          <h3 v-if="index === 0 || dateLabel(entry) !== dateLabel(filteredEntries[index - 1])" class="activity-date">
            {{ dateLabel(entry) }}
          </h3>
          <article
            :class="['activity-card', { 'activity-milestone': presentations.get(entry.id).milestone }]"
            :style="{
              '--member-hue': `${groupStore.memberColors.get(members.get(entry.member_id)).hueDegrees}deg`,
            }"
          >
            <div class="activity-card-player">
              <PlayerIcon :name="members.get(entry.member_id)" /><strong>{{ members.get(entry.member_id) }}</strong
              ><span v-if="activityIsLive(entry, timestamp)" class="activity-live">Live</span
              ><time
                :datetime="new Date(entry.started_at).toISOString()"
                :title="new Date(entry.started_at).toLocaleString()"
                >{{ relativeTime(entry) }}</time
              >
            </div>
            <div class="activity-card-event">
              <CachedImage :src="presentations.get(entry.id).icon" alt="" width="28" height="28" /><span
                :key="entry.revision"
                class="activity-counter"
                >{{ presentations.get(entry.id).text }}</span
              >
            </div>
            <span v-if="presentations.get(entry.id).collectionUnlock" class="activity-unlock">New collection item</span>
            <div v-if="presentations.get(entry.id).skills?.length > 1" class="activity-skill-icons">
              <CachedImage
                v-for="skill in presentations.get(entry.id).skills"
                :key="skill"
                :src="skillIcons[skill]"
                :alt="skill"
                :title="skill"
                width="16"
                height="16"
              />
            </div>
            <details v-if="presentations.get(entry.id).details.length" class="activity-card-details">
              <summary>
                <span>{{ timeRange(entry) }}</span
                ><span>Details</span>
              </summary>
              <ul>
                <li v-for="detail in presentations.get(entry.id).details" :key="detail">
                  <span class="activity-detail-content">
                    <template v-if="entry.type === 'level'">
                      <span>Level {{ entry.data.before }}</span>
                      <svg width="10" height="8" viewBox="0 0 10 8" role="img" aria-label="to">
                        <path d="M0 4h8M5 1l3 3-3 3" fill="none" stroke="currentColor" />
                      </svg>
                      <span>{{ entry.data.after }}</span>
                    </template>
                    <span v-else>{{ detail }}</span>
                  </span>
                </li>
              </ul>
            </details>
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
