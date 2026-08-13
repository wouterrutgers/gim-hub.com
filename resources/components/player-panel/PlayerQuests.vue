<script setup>
  import { computed, ref } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { useMemberQuests } from "../../stores/group";
  import CachedImage from "../cached-image/CachedImage.vue";
  import SearchElement from "../search-element/SearchElement.vue";
  import "./player-quests.css";

  const props = defineProps({
    member: { type: String, required: true },
  });

  const gameDataStore = useGameDataStore();
  const quests = useMemberQuests(function getMember() {
    return props.member;
  });

  const nameFilter = ref("");

  const questList = computed(function getQuestList() {
    return [...(gameDataStore.gameData.quests?.entries() ?? [])]
      .filter(function matchesFilter([, quest]) {
        return !quest.hidden && quest.name.toLowerCase().includes(nameFilter.value.toLowerCase());
      })
      .map(function buildQuest([id, quest]) {
        return { id, ...quest, status: quests.value?.get(id) ?? "NOT_STARTED" };
      });
  });
  const possiblePoints = computed(function getPossiblePoints() {
    return [...(gameDataStore.gameData.quests?.values() ?? [])].reduce(function addPoints(total, quest) {
      return total + quest.points;
    }, 0);
  });
  const currentPoints = computed(function getCurrentPoints() {
    return [...(quests.value?.entries() ?? [])].reduce(function addCompletedPoints(total, [id, progress]) {
      return progress === "FINISHED" ? total + (gameDataStore.gameData.quests?.get(id)?.points ?? 0) : total;
    }, 0);
  });
  const questSections = computed(function getQuestSections() {
    return [
      {
        title: "Free quests",
        quests: questList.value.filter(function isFree(quest) {
          return !quest.member && !quest.tutorial;
        }),
      },
      {
        title: "Members' quests",
        quests: questList.value.filter(function isMembersQuest(quest) {
          return quest.member && !quest.miniquest && !quest.tutorial;
        }),
      },
      {
        title: "Miniquests",
        quests: questList.value.filter(function isMiniquest(quest) {
          return quest.miniquest;
        }),
      },
      {
        title: "Tutorial",
        quests: questList.value.filter(function isTutorial(quest) {
          return quest.tutorial;
        }),
      },
    ];
  });

  function getQuestWikiLink(name) {
    return `https://oldschool.runescape.wiki/w/${name.replaceAll(" ", "_")}/Quick_guide`;
  }

  function getQuestClass(status) {
    return {
      NOT_STARTED: "player-quests-not-started",
      IN_PROGRESS: "player-quests-in-progress",
      FINISHED: "player-quests-finished",
    }[status];
  }

  function getDifficultyIcon(difficulty) {
    return {
      Novice: "/icons/3399-0.png",
      Intermediate: "/icons/3400-0.png",
      Experienced: "/icons/3402-0.png",
      Master: "/icons/3403-0.png",
      Grandmaster: "/icons/3404-0.png",
      Special: "/icons/3404-0.png",
    }[difficulty];
  }
</script>

<template>
  <div class="player-quests">
    <div class="player-quests-top">
      <SearchElement class-name="player-quests-filter" placeholder="Filter quests" @change="nameFilter = $event" />
      <div class="player-quests-points">
        <span class="player-quests-current-points">{{ currentPoints }}</span> / {{ possiblePoints }}
      </div>
    </div>
    <div class="player-quests-list">
      <template v-for="section in questSections" :key="section.title">
        <h4 class="player-quests-section-header">{{ section.title }}</h4>
        <a
          v-for="quest in section.quests"
          :key="quest.id"
          :href="getQuestWikiLink(quest.name)"
          :class="['player-quests-quest', getQuestClass(quest.status)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          <CachedImage
            class="player-quests-difficulty-icon"
            :src="getDifficultyIcon(quest.difficulty)"
            :alt="quest.difficulty"
          />
          {{ quest.name }}
        </a>
      </template>
    </div>
  </div>
</template>
