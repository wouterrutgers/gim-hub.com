<script setup>
  import { RouterLink } from "vue-router";
  import SkillGraph from "../skill-graph/SkillGraph.vue";
  import "./history-page.css";
</script>

<template>
  <div id="history-page">
    <section class="history-page-skill-history" aria-labelledby="skill-history-heading">
      <h2 id="skill-history-heading">Skill history</h2>
      <SkillGraph />
    </section>
    <p class="history-page-settings-notice">
      Enable "Expand all player rows by default" in
      <RouterLink to="/group/settings" class="orange-link">settings</RouterLink> to automatically show everyone's skill
      breakdown.
    </p>
  </div>
</template>
