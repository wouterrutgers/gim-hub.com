<script setup>
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import { useSettingsStore } from "../../stores/settings";
  import AppNavigation from "../app-navigation/AppNavigation.vue";
  import ActivityFeed from "../player-activity/ActivityFeed.vue";
  import SidePanels from "./SidePanels.vue";
  import PluginWarnings from "./PluginWarnings.vue";
  import "./layout.css";

  const props = defineProps({
    showPanels: { type: Boolean, default: false },
  });

  const apiStore = useApiStore();
  const route = useRoute();
  const settingsStore = useSettingsStore();
  const groupName = computed(function getGroupName() {
    return apiStore.credentials?.name ?? "";
  });
</script>

<template>
  <div class="authed-layout">
    <div class="authed-workspace">
      <SidePanels v-if="props.showPanels" />
      <div id="main-content" class="pointer-passthrough">
        <AppNavigation :group-name="groupName" />
        <PluginWarnings />
        <slot />
      </div>
    </div>
    <ActivityFeed
      id="group-activity-sidebar"
      v-show="route.path !== '/group/panels' && settingsStore.showActivitySidebar"
      class="activity-dock"
    />
  </div>
</template>
