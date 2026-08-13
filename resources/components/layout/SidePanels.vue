<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import PlayerPanel from "../player-panel/PlayerPanel.vue";

  const groupStore = useGroupStore();

  const groupMembers = computed(function getGroupMembers() {
    return [...groupStore.memberNames]
      .filter(function excludeSharedMember(member) {
        return member !== "@SHARED";
      })
      .sort(function sortMembers(left, right) {
        return left.localeCompare(right);
      });
  });
</script>

<template>
  <div id="side-panels-container">
    <template v-if="groupMembers.length === 0">
      <div v-for="placeholder in 2" :key="placeholder" style="position: relative">
        <PlayerPanel />
        <div style="position: absolute; background: rgba(0 0 0 / 60%); inset: 0">
          <LoadingScreen />
        </div>
      </div>
    </template>

    <PlayerPanel v-for="member in groupMembers" v-else :key="member" :member="member" />
  </div>
</template>
