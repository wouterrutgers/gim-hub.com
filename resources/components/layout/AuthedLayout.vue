<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useSettingsStore } from "../../stores/settings";
  import AppNavigation from "../app-navigation/AppNavigation.vue";
  import ActivityFeed from "../player-activity/ActivityFeed.vue";
  import SidePanels from "./SidePanels.vue";
  import PluginWarnings from "./PluginWarnings.vue";
  import "./layout.css";

  const props = defineProps({
    showPanels: { type: Boolean, default: false },
    hideHeader: { type: Boolean, default: false },
  });

  const apiStore = useApiStore();
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
        <AppNavigation v-if="!props.hideHeader" :group-name="groupName" />
        <PluginWarnings />
        <slot />
      </div>
    </div>
    <ActivityFeed id="group-activity-sidebar" v-show="settingsStore.showActivitySidebar" class="activity-dock" />
  </div>
</template>
