<script setup>
  import { computed, ref } from "vue";
  import { combatAchievementTiers } from "../../game/combat-achievements";
  import { useGameDataStore } from "../../stores/game-data";
  import { useMemberCombatAchievements } from "../../stores/group";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import SearchElement from "../search-element/SearchElement.vue";
  import "./combat-achievements.css";

  const props = defineProps({ player: { type: String, required: true } });
  const emit = defineEmits(["close"]);
  const gameDataStore = useGameDataStore();
  const completedTasks = useMemberCombatAchievements(function getPlayer() {
    return props.player;
  });
  const search = ref("");
  const selectedTier = ref(0);
  const selectedStatus = ref("");

  const tasks = computed(function getTasks() {
    return (gameDataStore.gameData.combatAchievements ?? []).map(function taskProgress(task) {
      return { ...task, complete: completedTasks.value?.has(task.id) ?? false };
    });
  });
  const tiers = computed(function getTiers() {
    return combatAchievementTiers.map(function summarizeTier(name, index) {
      const tierTasks = tasks.value.filter(function matchesTier(task) {
        return task.tier === index + 1;
      });

      return {
        name,
        tier: index + 1,
        icon: `/item-icons/${25926 + index * 2}.webp`,
        total: tierTasks.length,
        completed: tierTasks.filter(function isComplete(task) {
          return task.complete;
        }).length,
      };
    });
  });
  const summary = computed(function summarizeProgress() {
    return tasks.value.reduce(
      function addTask(total, task) {
        total.possiblePoints += task.tier;

        if (task.complete) {
          total.completed++;
          total.points += task.tier;
        }

        return total;
      },
      { completed: 0, points: 0, possiblePoints: 0 },
    );
  });
  const filteredTasks = computed(function filterTasks() {
    const query = search.value.trim().toLowerCase();

    return tasks.value.filter(function matchesFilters(task) {
      return (
        (!selectedTier.value || task.tier === selectedTier.value) &&
        (!selectedStatus.value || (selectedStatus.value === "complete" ? task.complete : task.complete === false)) &&
        (!query || `${task.name} ${task.description} ${task.monster}`.toLowerCase().includes(query))
      );
    });
  });
  const hasFilters = computed(function filtersAreActive() {
    return Boolean(search.value || selectedTier.value || selectedStatus.value);
  });

  function clearFilters() {
    search.value = "";
    selectedTier.value = 0;
    selectedStatus.value = "";
  }

  function taskWikiLink(task) {
    return `https://oldschool.runescape.wiki/w/${encodeURIComponent(task.name.replaceAll(" ", "_"))}`;
  }
</script>

<template>
  <section
    class="combat-achievements metal-border rsbackground"
    role="dialog"
    aria-modal="true"
    aria-labelledby="combat-achievements-title"
  >
    <header class="combat-achievements-header">
      <CachedImage src="/item-icons/25956.webp" alt="" :width="32" :height="32" />
      <div>
        <h1 id="combat-achievements-title">Combat achievements</h1>
        <div class="combat-achievements-player"><PlayerIcon :name="props.player" /> {{ props.player }}</div>
      </div>
      <button class="dialog-close" aria-label="Close combat achievements" @click="emit('close')">
        <CachedImage src="/ui/1731-0.png" alt="" />
      </button>
    </header>
    <div class="combat-achievements-title-border" />

    <template v-if="tasks.length">
      <div class="combat-achievements-overview">
        <div class="combat-achievements-totals">
          <div>
            <span class="combat-achievements-label">Tasks completed</span>
            <strong
              >{{ summary.completed.toLocaleString() }}
              <span class="combat-achievements-total-max">/ {{ tasks.length.toLocaleString() }}</span></strong
            >
          </div>
          <div class="combat-achievements-points">
            <span class="combat-achievements-label">Total points</span>
            <strong
              >{{ summary.points.toLocaleString() }}
              <span class="combat-achievements-total-max">/ {{ summary.possiblePoints.toLocaleString() }}</span></strong
            >
          </div>
        </div>
        <progress
          class="combat-achievements-progress"
          :value="summary.completed"
          :max="tasks.length"
          aria-label="Total tasks completed"
        />

        <div class="combat-achievements-tiers" aria-label="Filter by tier">
          <button
            v-for="tier in tiers"
            :key="tier.tier"
            :class="[
              'combat-achievements-tier',
              'rsborder-tiny',
              { 'combat-achievements-tier-selected': selectedTier === tier.tier },
            ]"
            :aria-pressed="selectedTier === tier.tier"
            @click="selectedTier = selectedTier === tier.tier ? 0 : tier.tier"
          >
            <CachedImage :src="tier.icon" alt="" :width="36" :height="32" />
            <span class="combat-achievements-tier-name">{{ tier.name }}</span>
            <span class="combat-achievements-tier-count">{{ tier.completed }} / {{ tier.total }}</span>
            <progress
              class="combat-achievements-progress"
              :value="tier.completed"
              :max="tier.total"
              :aria-label="`${tier.name} tasks completed`"
            />
          </button>
        </div>
      </div>

      <div class="combat-achievements-filters">
        <label class="combat-achievements-search">
          <span class="combat-achievements-label">Search tasks</span>
          <SearchElement :value="search" placeholder="Search tasks or monsters" @change="search = $event" />
        </label>
        <label>
          <span class="combat-achievements-label">Completed</span>
          <span class="select-container"
            ><select v-model="selectedStatus">
              <option value="">All</option>
              <option value="incomplete">Incomplete</option>
              <option value="complete">Complete</option>
            </select></span
          >
        </label>
      </div>

      <div class="combat-achievements-results">
        <h2 aria-live="polite">
          {{ selectedTier ? combatAchievementTiers[selectedTier - 1] : "All" }} tasks
          <span class="combat-achievements-result-count">{{ filteredTasks.length }}</span>
        </h2>
        <button v-if="hasFilters" class="orange-link" @click="clearFilters">Clear filters</button>
        <span v-else class="combat-achievements-wiki-hint">Select a task to open the wiki</span>
      </div>

      <ul v-if="filteredTasks.length" class="combat-achievements-tasks">
        <li v-for="task in filteredTasks" :key="task.id">
          <a
            :href="taskWikiLink(task)"
            target="_blank"
            rel="noopener noreferrer"
            :class="['combat-achievements-task', { 'combat-achievements-task-complete': task.complete }]"
          >
            <span class="combat-achievements-status" :aria-label="task.complete ? 'Complete' : 'Incomplete'">{{
              task.complete ? "✓" : ""
            }}</span>
            <div class="combat-achievements-task-body">
              <div class="combat-achievements-task-name">{{ task.name }}</div>
              <p>{{ task.description }}</p>
              <div class="combat-achievements-task-meta">
                {{ task.monster }} <span aria-hidden="true" /> {{ combatAchievementTiers[task.tier - 1] }}
              </div>
            </div>
            <span class="combat-achievements-task-points"
              >{{ task.tier }} <span>{{ task.tier === 1 ? "point" : "points" }}</span></span
            >
          </a>
        </li>
      </ul>
      <div v-else class="combat-achievements-empty" role="status">
        <h3>No tasks match your filters</h3>
        <p>Try another search or clear your filters to see all tasks.</p>
        <button class="men-button" @click="clearFilters">Clear filters</button>
      </div>
    </template>
    <p v-else class="combat-achievements-empty" role="status">Loading combat achievements...</p>
  </section>
</template>
