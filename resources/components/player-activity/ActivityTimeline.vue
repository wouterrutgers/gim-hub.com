<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { activityPresentation } from "../../game/activity";
  import CachedImage from "../cached-image/CachedImage.vue";

  const props = defineProps({
    rows: { type: Array, required: true },
    members: { type: Map, required: true },
    timestamp: { type: Number, required: true },
  });
  const gameDataStore = useGameDataStore();
  const presentations = computed(function getPresentations() {
    return new Map(
      props.rows.map(function present({ entry }) {
        return [entry.id, activityPresentation(entry, gameDataStore.gameData)];
      }),
    );
  });

  function sectionLabel({ entry, recentSession }) {
    if (recentSession) {
      return "Recent progress";
    }

    const date = new Date(entry.started_at);

    if (entry.is_weekly) {
      return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
    }

    const today = new Date(props.timestamp);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    today.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function lastActivityLabel(timestamp) {
    const minutes = Math.floor((props.timestamp - timestamp) / 60_000);

    return minutes < 1 ? "Updated just now" : `Updated ${minutes}m ago`;
  }

  function entryClock(entry) {
    if (entry.is_weekly) {
      return "Week";
    }

    return clockTime(entry.started_at);
  }

  function clockTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
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

    const start = clockTime(entry.started_at);

    return entry.started_at === entry.occurred_at ? start : `${start} to ${clockTime(entry.occurred_at)}`;
  }
</script>

<template>
  <ol class="activity-timeline" role="list">
    <li v-for="({ entry, recentSession }, index) in props.rows" :key="entry.id" :data-entry-id="entry.id">
      <h3
        v-if="index === 0 || sectionLabel(props.rows[index]) !== sectionLabel(props.rows[index - 1])"
        class="activity-date"
        :class="{ 'activity-recent-heading': recentSession }"
      >
        {{ sectionLabel(props.rows[index]) }}
      </h3>
      <article :class="['activity-card', { 'activity-milestone': presentations.get(entry.id).milestone }]">
        <component :is="presentations.get(entry.id).details.length ? 'details' : 'div'" class="activity-card-content">
          <component :is="presentations.get(entry.id).details.length ? 'summary' : 'div'" class="activity-card-summary">
            <span class="activity-card-header">
              <strong class="activity-card-player">{{ props.members.get(entry.member_id) }}</strong>
              <time
                v-if="recentSession"
                class="activity-time"
                :datetime="new Date(entry.occurred_at).toISOString()"
                :title="new Date(entry.occurred_at).toLocaleString()"
                >{{ lastActivityLabel(entry.occurred_at) }}</time
              >
              <time
                v-else
                class="activity-time"
                :datetime="new Date(entry.started_at).toISOString()"
                :title="entry.is_weekly ? `${timeRange(entry)} (UTC)` : new Date(entry.started_at).toLocaleString()"
                >{{ entryClock(entry) }}</time
              >
            </span>
            <span class="activity-card-description">
              <span class="activity-card-event">{{ presentations.get(entry.id).text }}</span>
              <span v-if="entry.type === 'xp'" class="activity-skill-icons">
                <CachedImage
                  v-for="detail in presentations.get(entry.id).details"
                  :key="detail.skill"
                  class="activity-icon"
                  :src="detail.icon"
                  :alt="detail.skill"
                  width="16"
                  height="16"
                />
              </span>
              <CachedImage
                v-else-if="
                  ['level', 'boss', 'loot', 'collection'].includes(entry.type) || presentations.get(entry.id).milestone
                "
                class="activity-icon"
                :src="presentations.get(entry.id).icon"
                alt=""
                width="16"
                height="16"
              />
              <span v-if="presentations.get(entry.id).collectionUnlock" class="activity-unlock"
                >New collection item</span
              >
            </span>
            <span
              v-if="presentations.get(entry.id).details.length"
              class="activity-card-chevron chevron chevron-right"
              aria-hidden="true"
            />
          </component>
          <div v-if="presentations.get(entry.id).details.length" class="activity-card-details">
            <p class="activity-detail-range">{{ timeRange(entry) }}{{ entry.is_weekly ? " (UTC)" : "" }}</p>
            <ul role="list">
              <li v-for="detail in presentations.get(entry.id).details" :key="detail.text">
                <CachedImage
                  v-if="detail.icon"
                  class="activity-detail-icon"
                  :src="detail.icon"
                  alt=""
                  width="16"
                  height="16"
                />
                {{ detail.text }}
              </li>
            </ul>
          </div>
        </component>
      </article>
    </li>
  </ol>
</template>
