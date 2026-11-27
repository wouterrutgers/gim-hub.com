<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { activityPresentation } from "../../game/activity";
  import { itemWikiUrl } from "../../game/items";
  import CachedImage from "../cached-image/CachedImage.vue";

  const props = defineProps({
    rows: { type: Array, required: true },
    members: { type: Map, required: true },
    timestamp: { type: Number, required: true },
  });
  const emit = defineEmits(["open-collection-log"]);
  const gameDataStore = useGameDataStore();
  const timeline = computed(function getTimeline() {
    return props.rows.map(function present(row) {
      return { ...row, presentation: activityPresentation(row.entry, gameDataStore.gameData) };
    });
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
    <li v-for="({ entry, recentSession, presentation }, index) in timeline" :key="entry.id" :data-entry-id="entry.id">
      <h3
        v-if="index === 0 || sectionLabel(props.rows[index]) !== sectionLabel(props.rows[index - 1])"
        class="activity-date"
        :class="{ 'activity-recent-heading': recentSession }"
      >
        {{ sectionLabel(props.rows[index]) }}
      </h3>
      <article :class="['activity-card', { 'activity-milestone': presentation.milestone }]">
        <component :is="presentation.details.length ? 'details' : 'div'" class="activity-card-content">
          <component :is="presentation.details.length ? 'summary' : 'div'" class="activity-card-summary">
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
              <component
                :is="presentation.collectionItemId === undefined ? 'a' : 'button'"
                v-if="presentation.itemId !== undefined"
                class="activity-card-event activity-item-action"
                v-bind="
                  presentation.collectionItemId === undefined
                    ? { href: itemWikiUrl(presentation.itemId), target: '_blank', rel: 'noopener noreferrer' }
                    : { type: 'button', 'aria-haspopup': 'dialog' }
                "
                :aria-label="
                  presentation.collectionItemId === undefined
                    ? `${presentation.text}, open on the OSRS Wiki`
                    : `${presentation.text}, open ${props.members.get(entry.member_id)}'s collection log`
                "
                @click="
                  presentation.collectionItemId !== undefined &&
                  emit('open-collection-log', props.members.get(entry.member_id), presentation.collectionItemId)
                "
              >
                {{ presentation.text }}
                <CachedImage class="activity-icon" :src="presentation.icon" alt="" width="16" height="16" />
              </component>
              <span v-else class="activity-card-event">{{ presentation.text }}</span>
              <span v-if="entry.type === 'xp'" class="activity-skill-icons">
                <CachedImage
                  v-for="detail in presentation.details"
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
                  presentation.itemId === undefined &&
                  (['level', 'boss'].includes(entry.type) || presentation.milestone)
                "
                class="activity-icon"
                :src="presentation.icon"
                alt=""
                width="16"
                height="16"
              />
              <span v-if="presentation.collectionUnlock" class="activity-unlock">New collection item</span>
            </span>
            <span
              v-if="presentation.details.length"
              class="activity-card-chevron chevron chevron-right"
              aria-hidden="true"
            />
          </component>
          <div v-if="presentation.details.length" class="activity-card-details">
            <p class="activity-detail-range">{{ timeRange(entry) }}{{ entry.is_weekly ? " (UTC)" : "" }}</p>
            <ul role="list">
              <li v-for="detail in presentation.details" :key="detail.text">
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
