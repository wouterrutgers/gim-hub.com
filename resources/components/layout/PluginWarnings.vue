<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import "./plugin-warnings.css";

  const groupStore = useGroupStore();
  const warnings = computed(function getPluginWarnings() {
    return [...groupStore.memberStates]
      .filter(function hasWarning([, member]) {
        return member.pluginStatus;
      })
      .map(function memberWarning([name, member]) {
        return { name, ...member.pluginStatus };
      });
  });
</script>

<template>
  <section
    v-if="warnings.length"
    class="plugin-warnings rsbackground"
    role="status"
    aria-labelledby="plugin-warnings-title"
  >
    <div class="plugin-warnings-heading">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3Z" stroke-linejoin="round" />
        <path d="M12 9v5m0 3v1" stroke-linecap="round" />
      </svg>
      <h2 id="plugin-warnings-title">Plugin updates needed</h2>
    </div>
    <ul>
      <li v-for="warning in warnings" :key="warning.name">
        <strong>{{ warning.name }}</strong>
        <span v-if="warning.reason === 'wrong_plugin'">
          Using Group Ironmen Tracker. Switch to GIM hub and disable the old plugin.
        </span>
        <span v-else-if="warning.installed_version">
          Using GIM hub {{ warning.installed_version }}. Update to {{ warning.latest_version }}.
        </span>
        <span v-else>A newer GIM hub plugin is available. Update to {{ warning.latest_version }}.</span>
      </li>
    </ul>
    <p class="plugin-warnings-instructions">
      Install or update <strong>GIM hub</strong> in RuneLite’s Plugin Hub, then restart RuneLite.
    </p>
  </section>
</template>
