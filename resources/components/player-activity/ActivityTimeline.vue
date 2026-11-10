<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { activityIsLive, activityPresentation } from "../../game/activity";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";

  const props = defineProps({
    entries: { type: Array, required: true },
    members: { type: Map, required: true },
    timestamp: { type: Number, required: true },
  });
  const gameDataStore = useGameDataStore();
  const presentations = computed(function getPresentations() {
    return new Map(
      props.entries.map(function present(entry) {
        return [entry.id, activityPresentation(entry, gameDataStore.gameData)];
      }),
    );
  });

  function dateLabel(entry) {
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

  function relativeTime(entry) {
    if (entry.is_weekly) {
      return "Weekly summary";
    }

    const minutes = Math.max(0, Math.floor((props.timestamp - entry.started_at) / 60_000));

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
    const end = activityIsLive(entry, props.timestamp)
      ? "now"
      : new Date(entry.occurred_at).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });

    return entry.started_at === entry.occurred_at && !activityIsLive(entry, props.timestamp)
      ? start
      : `${start} to ${end}`;
  }
</script>

<template>
  <ol class="activity-timeline">
    <li v-for="(entry, index) in props.entries" :key="entry.id" :data-entry-id="entry.id">
      <h3 v-if="index === 0 || dateLabel(entry) !== dateLabel(props.entries[index - 1])" class="activity-date">
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
            <PlayerIcon :name="props.members.get(entry.member_id)" />
            <strong>{{ props.members.get(entry.member_id) }}</strong
            >:
          </span>
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
            v-else-if="['level', 'boss'].includes(entry.type) || presentations.get(entry.id).milestone"
            class="activity-icon"
            :src="presentations.get(entry.id).icon"
            alt=""
            width="16"
            height="16"
          />
          <span v-if="activityIsLive(entry, props.timestamp)" class="activity-live">Live</span>
          <span v-if="presentations.get(entry.id).collectionUnlock" class="activity-unlock">New collection item</span>
          <details v-if="presentations.get(entry.id).details.length" class="activity-card-details">
            <summary><span class="chevron chevron-right" aria-hidden="true" /><span>Details</span></summary>
            <p class="activity-detail-range">{{ timeRange(entry) }}{{ entry.is_weekly ? " (UTC)" : "" }}</p>
            <ul>
              <li v-for="detail in presentations.get(entry.id).details" :key="detail.text">
                <span class="activity-detail-content">
                  <CachedImage
                    v-if="detail.icon"
                    class="activity-detail-icon"
                    :src="detail.icon"
                    alt=""
                    width="16"
                    height="16"
                  />
                  {{ detail.text }}
                </span>
              </li>
            </ul>
          </details>
        </div>
      </article>
    </li>
  </ol>
</template>
