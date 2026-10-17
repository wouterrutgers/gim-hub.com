<script setup>
  import { computed, nextTick, ref, watch } from "vue";
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
  const isActivityPage = computed(function activityPageIsOpen() {
    return route.path === "/group/activity";
  });
  const activityPageTarget = ref();

  watch(
    isActivityPage,
    async function moveActivityToPage() {
      await nextTick();
      activityPageTarget.value = isActivityPage.value ? document.getElementById("activity-page") : undefined;
    },
    { immediate: true },
  );
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
    <Teleport :to="activityPageTarget" :disabled="!activityPageTarget">
      <ActivityFeed
        id="group-activity-sidebar"
        v-show="isActivityPage || (route.path !== '/group/panels' && settingsStore.showActivitySidebar)"
        :collapsible="!isActivityPage"
        :class="isActivityPage ? 'activity-page-feed' : 'activity-dock'"
      />
    </Teleport>
  </div>
</template>
