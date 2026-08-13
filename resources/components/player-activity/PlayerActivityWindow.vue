<script setup>
  import { computed, ref, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { useSnapshotStore } from "../../stores/snapshots";
  import { diaryRegions, diaryTiers } from "../../game/diaries";
  import { skillIcons } from "../../game/skill";
  import { computeActivity } from "../../game/player-activity";
  import CachedImage from "../cached-image/CachedImage.vue";
  import { BOSS_KC_KEYS } from "../collection-log/boss-kc";
  import "./player-activity.css";

  const props = defineProps({
    player: { type: String, required: true },
    currentHiscores: { type: Map, default: undefined },
    onClearSnapshot: { type: Function, default: undefined },
  });
  const emit = defineEmits(["close"]);

  const apiStore = useApiStore();
  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const snapshotStore = useSnapshotStore();

  const snapshotView = ref("lastVisit");
  const fetchedHiscores = ref();
  const clearingSnapshot = ref(false);
  const clearSnapshotError = ref();

  const baseline = computed(function getBaseline() {
    return snapshotStore.getBaselineSnapshot(props.player, snapshotView.value);
  });
  const activity = computed(function getActivity() {
    const currentState = groupStore.memberStates.get(props.player);

    return baseline.value && currentState ? computeActivity(baseline.value.snapshot, currentState) : undefined;
  });
  const skillChanges = computed(function getSkillChanges() {
    return activity.value?.skillChanges ?? [];
  });
  const questChanges = computed(function getQuestChanges() {
    return activity.value?.questChanges ?? [];
  });
  const diaryChanges = computed(function getDiaryChanges() {
    return activity.value?.diaryChanges ?? [];
  });
  const collectionChanges = computed(function getCollectionChanges() {
    return activity.value?.collectionChanges ?? [];
  });
  const bossKcBefore = computed(function getBossKillCountsBefore() {
    return activity.value?.bossKcBefore ?? {};
  });
  const levelUps = computed(function getLevelUps() {
    return skillChanges.value.filter(function gainedLevel(change) {
      return change.levelAfter > change.levelBefore;
    });
  });
  const sortedDiaryChanges = computed(function getSortedDiaryChanges() {
    return [...diaryChanges.value].sort(function sortDiaryChanges(left, right) {
      const regionDifference = diaryRegions.indexOf(left.region) - diaryRegions.indexOf(right.region);

      return regionDifference !== 0 ? regionDifference : diaryTiers.indexOf(left.tier) - diaryTiers.indexOf(right.tier);
    });
  });
  const hiscores = computed(function getHiscores() {
    return props.currentHiscores ?? fetchedHiscores.value;
  });
  const bossKillCountChanges = computed(function getBossKillCountChanges() {
    if (hiscores.value === undefined) {
      return undefined;
    }

    return Object.entries(bossKcBefore.value)
      .filter(function isTrackedBoss([key]) {
        return BOSS_KC_KEYS.has(key);
      })
      .flatMap(function getIncrease([boss, before]) {
        const after = hiscores.value.get(boss) ?? 0;

        return after > before ? [{ boss, before, after }] : [];
      })
      .sort(function sortByIncrease(left, right) {
        return right.after - right.before - (left.after - left.before);
      });
  });
  const hasChanges = computed(function activityHasChanges() {
    return [skillChanges, questChanges, diaryChanges, collectionChanges].some(function hasEntries(changes) {
      return changes.value.length > 0;
    });
  });
  const snapshotLabel = computed(function getSnapshotLabel() {
    if (!baseline.value) {
      return "";
    }

    if (baseline.value.view === "lastWeek" || !baseline.value.hasSeenMarker) {
      return "Since a week";
    }

    return `Since ${formatRelativeTime(baseline.value.snapshot.timestamp)}`;
  });

  function formatNumber(number) {
    return number.toLocaleString();
  }

  function formatRelativeTime(timestamp) {
    const minutes = Math.floor((Date.now() - timestamp) / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    }

    if (hours > 0) {
      return `${hours}h ago`;
    }

    return minutes > 0 ? `${minutes}m ago` : "just now";
  }

  function questStatus(change) {
    if (change.statusAfter === "FINISHED") {
      return { label: "Completed", className: "player-activity-quest-finished" };
    }

    if (change.statusAfter === "IN_PROGRESS") {
      return { label: "Started", className: "player-activity-quest-in-progress" };
    }

    return { label: "Not started", className: "player-activity-quest-not-started" };
  }

  async function clearSnapshot() {
    if (!props.onClearSnapshot || clearingSnapshot.value) {
      return;
    }

    clearingSnapshot.value = true;
    clearSnapshotError.value = undefined;

    try {
      await props.onClearSnapshot();
      emit("close");
    } catch {
      clearSnapshotError.value = "Could not clear activity. Please try again.";
    } finally {
      clearingSnapshot.value = false;
    }
  }

  watch(
    [
      function getPlayer() {
        return props.player;
      },
      bossKcBefore,
      function getPassedHiscores() {
        return props.currentHiscores;
      },
    ],
    function loadHiscores([player, bossCounts, passedHiscores], _previousValues, onCleanup) {
      if (passedHiscores !== undefined || Object.keys(bossCounts).length === 0 || !apiStore.client) {
        return;
      }

      let cancelled = false;
      onCleanup(function cancelHiscoresRequest() {
        cancelled = true;
      });
      apiStore.client.fetchMemberHiscores(player).then(
        function storeHiscores(result) {
          if (!cancelled) fetchedHiscores.value = result;
        },
        function storeEmptyHiscores() {
          if (!cancelled) fetchedHiscores.value = new Map();
        },
      );
    },
    { immediate: true },
  );
</script>

<template>
  <div class="player-activity rsborder rsbackground">
    <div class="player-activity-header">
      <h2>{{ `${props.player}'s recent activity` }}</h2>
      <button
        class="player-activity-close dialog-close"
        aria-label="Close"
        data-tooltip="Close dialog"
        @click="emit('close')"
      >
        <CachedImage src="/ui/1731-0.png" alt="Close dialog" />
      </button>
    </div>

    <div class="player-activity-meta">
      <p v-if="baseline" class="player-activity-since">
        {{ snapshotLabel }} - {{ new Date(baseline.snapshot.timestamp).toLocaleString() }}
      </p>
      <select v-model="snapshotView" class="player-activity-view" aria-label="Activity view">
        <option value="lastVisit">Since last visit</option>
        <option value="lastWeek">Last week</option>
      </select>
    </div>

    <p v-if="!hasChanges && Object.keys(bossKcBefore).length === 0" class="player-activity-empty">
      No activity recorded.
    </p>

    <div class="player-activity-body">
      <section v-if="skillChanges.length > 0" class="player-activity-section">
        <h3 class="player-activity-section-title">Skills</h3>
        <div v-if="levelUps.length > 0" class="player-activity-subsection">
          <h4 class="player-activity-subsection-title">Level ups</h4>
          <div class="player-activity-levelups">
            <div v-for="change in levelUps" :key="change.skill" class="player-activity-levelup">
              <CachedImage
                :alt="`${change.skill} icon`"
                :src="skillIcons[change.skill] ?? ''"
                class="player-activity-skill-icon"
              />
              <span class="player-activity-skill-name">{{ change.skill }}</span>
              <span class="player-activity-level-change player-activity-counter">
                <span>{{ change.levelBefore }}</span
                ><span class="arrow">→</span><span>{{ change.levelAfter }}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="player-activity-subsection">
          <h4 class="player-activity-subsection-title">XP gained</h4>
          <div class="player-activity-xp-list">
            <div v-for="change in skillChanges" :key="change.skill" class="player-activity-xp-row">
              <CachedImage
                :alt="`${change.skill} icon`"
                :src="skillIcons[change.skill] ?? ''"
                class="player-activity-skill-icon"
              />
              <span class="player-activity-skill-name">{{ change.skill }}</span>
              <span class="player-activity-xp-gained">
                +{{ formatNumber(change.experienceAfter - change.experienceBefore) }}
              </span>
              <span class="player-activity-xp-total">{{ formatNumber(change.experienceAfter) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="questChanges.length > 0" class="player-activity-section">
        <h3 class="player-activity-section-title">Quests</h3>
        <div class="player-activity-quest-list">
          <div
            v-for="change in questChanges"
            :key="String(change.questId)"
            :class="['player-activity-quest-row', questStatus(change).className]"
          >
            <span class="player-activity-quest-status">{{ questStatus(change).label }}</span>
            <span class="player-activity-quest-name">
              {{ gameDataStore.gameData.quests?.get(change.questId)?.name ?? `Quest #${change.questId}` }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="diaryChanges.length > 0" class="player-activity-section">
        <h3 class="player-activity-section-title">Achievement diaries</h3>
        <div class="player-activity-diary-list">
          <div
            v-for="change in sortedDiaryChanges"
            :key="`${change.region}-${change.tier}`"
            class="player-activity-diary-region"
          >
            <span class="player-activity-diary-header">
              {{ change.region }} - {{ change.tier }}
              <span class="player-activity-diary-count">
                +{{ change.newlyCompletedIndices.length }} task{{
                  change.newlyCompletedIndices.length === 1 ? "" : "s"
                }}
              </span>
            </span>
            <ul
              v-if="gameDataStore.gameData.diaries?.get(change.region)?.get(change.tier)"
              class="player-activity-diary-tasks"
            >
              <li v-for="index in change.newlyCompletedIndices" :key="index">
                {{
                  gameDataStore.gameData.diaries.get(change.region).get(change.tier)[index]?.task ??
                  `Task #${index + 1}`
                }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="collectionChanges.length > 0" class="player-activity-section">
        <h3 class="player-activity-section-title">Collection log</h3>
        <div class="player-activity-collection-list">
          <div v-for="change in collectionChanges" :key="String(change.itemId)" class="player-activity-collection-row">
            <a
              :href="`https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${change.itemId}`"
              target="_blank"
              rel="noopener noreferrer"
              class="player-activity-collection-item"
            >
              <CachedImage
                :alt="gameDataStore.gameData.items?.get(change.itemId)?.name ?? `Item #${change.itemId}`"
                :src="`/item-icons/${change.itemId}.webp`"
                class="player-activity-collection-icon"
              />
              <span class="player-activity-collection-name">
                {{ gameDataStore.gameData.items?.get(change.itemId)?.name ?? `Item #${change.itemId}` }}
              </span>
              <span v-if="change.quantityBefore === 0" class="player-activity-collection-new">New!</span>
              <div v-else class="player-activity-collection-qty player-activity-counter">
                <span>{{ change.quantityBefore }}</span
                ><span class="arrow">→</span><span>{{ change.quantityAfter }}</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section v-if="bossKillCountChanges?.length > 0" class="player-activity-section">
        <h3 class="player-activity-section-title">Boss kills</h3>
        <div class="player-activity-bosskc-list">
          <div v-for="change in bossKillCountChanges" :key="change.boss" class="player-activity-bosskc-row">
            <span class="player-activity-bosskc-name">{{ change.boss }}</span>
            <span class="player-activity-bosskc-change player-activity-counter">
              <span>{{ formatNumber(change.before) }}</span
              ><span class="arrow">→</span><span>{{ formatNumber(change.after) }}</span>
            </span>
            <span class="player-activity-bosskc-gained">+{{ formatNumber(change.after - change.before) }}</span>
          </div>
        </div>
      </section>
    </div>

    <div v-if="props.onClearSnapshot" class="player-activity-footer">
      <p v-if="clearSnapshotError" class="player-activity-clear-error validation-error" role="alert">
        {{ clearSnapshotError }}
      </p>
      <button
        class="player-activity-dismiss men-button small"
        type="button"
        :disabled="clearingSnapshot"
        @click="clearSnapshot"
      >
        {{ clearingSnapshot ? "Clearing activity…" : "Clear activity" }}
      </button>
    </div>
  </div>
</template>
