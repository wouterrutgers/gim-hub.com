<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import PlayerPanel from "../player-panel/PlayerPanel.vue";
  import "./panels-page.css";

  const groupStore = useGroupStore();

  const groupMembers = computed(function getGroupMembers() {
    return [...groupStore.memberNames].filter(function excludeSharedMember(member) {
      return member !== "@SHARED";
    });
  });
</script>

<template>
  <div id="panels-page-container">
    <PlayerPanel v-for="member in groupMembers" :key="member" :member="member" />
  </div>
</template>
