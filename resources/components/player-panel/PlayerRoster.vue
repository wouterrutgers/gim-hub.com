<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import PlayerPanel from "./PlayerPanel.vue";
  import "./player-roster.css";

  const groupStore = useGroupStore();
  const members = computed(function groupMembers() {
    return [...groupStore.memberNames].filter(function excludeShared(name) {
      return name !== "@SHARED";
    });
  });
</script>

<template>
  <div class="player-roster">
    <div v-if="!groupStore.loaded" class="roster-loading"><LoadingScreen /></div>
    <p v-else-if="members.length === 0" class="roster-empty">No members in this group.</p>
    <template v-else>
      <PlayerPanel v-for="member in members" :key="member" :member="member" />
    </template>
  </div>
</template>
