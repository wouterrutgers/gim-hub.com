<script setup>
  import SkillGraph from "../skill-graph/SkillGraph.vue";
  import "./history-page.css";
</script>

<template>
  <div id="history-page">
    <section class="history-page-skill-history" aria-labelledby="skill-history-heading">
      <h2 id="skill-history-heading">Skill history</h2>
      <SkillGraph />
    </section>
  </div>
</template>
