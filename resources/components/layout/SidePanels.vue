<script setup>
  import PlayerRoster from "../player-panel/PlayerRoster.vue";
</script>

<template>
  <div id="side-panels-container">
    <div class="roster-heading">
      <h2>Your group</h2>
      <RouterLink to="/group/panels">View all</RouterLink>
    </div>
    <PlayerRoster />
  </div>
</template>
