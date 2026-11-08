<script setup>
  import { computed, nextTick, ref, watch } from "vue";
  import { useRoute } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import { useSettingsStore } from "../../stores/settings";
  import AppNavigation from "../app-navigation/AppNavigation.vue";
  import ActivityFeed from "../player-activity/ActivityFeed.vue";
  import PlayerPreferences from "../player-preferences/PlayerPreferences.vue";
  import SidePanels from "./SidePanels.vue";
  import PluginWarnings from "./PluginWarnings.vue";
  import "./layout.css";

  const props = defineProps({
    showPanels: { type: Boolean, default: false },
  });

  const apiStore = useApiStore();
  const route = useRoute();
  const settingsStore = useSettingsStore();
  usePlayerPreferencesStore().start();
  const groupName = computed(function getGroupName() {
    return apiStore.credentials?.name ?? "";
  });
  const isActivityPage = computed(function activityPageIsOpen() {
    return route.path === "/group/activity";
  });
  const isMapPage = computed(function mapPageIsOpen() {
    return route.path === "/group/map";
  });
  const pageName = computed(function getCurrentPageName() {
    return {
      "/group/items": "Group items",
      "/group/map": "World map",
      "/group/history": "Skill history",
      "/group/activity": "Group activity",
      "/group/panels": "Group members",
      "/group/settings": "Settings",
      "/group/setup-instructions": "Plugin setup",
      "/changelog": "What's new",
    }[route.path];
  });
  const activityPageTarget = ref();
  const activityFeed = ref();
  const activityToggle = ref();

  async function openActivitySidebar() {
    settingsStore.setShowActivitySidebar(true);
    await nextTick();
    activityFeed.value.$el.querySelector(".activity-collapse").focus();
  }

  watch(
    function activityIsShown() {
      return settingsStore.showActivitySidebar;
    },
    async function restoreActivityFocus(shown) {
      if (!shown && !isActivityPage.value && activityFeed.value.$el.contains(document.activeElement)) {
        await nextTick();
        activityToggle.value.focus();
      }
    },
  );

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
  <div
    class="authed-layout"
    :class="{ 'map-workspace': isMapPage, 'translucent-page-background': settingsStore.pageBackgroundOpacity < 100 }"
    :style="{ '--page-background-opacity': `${settingsStore.pageBackgroundOpacity}%` }"
  >
    <AppNavigation :group-name="groupName" />
    <aside v-if="props.showPanels" class="group-rail" aria-label="Your group">
      <SidePanels />
    </aside>
    <main id="main-content" class="pointer-passthrough" :aria-label="pageName">
      <PlayerPreferences />
      <PluginWarnings />
      <div class="workspace-page pointer-passthrough">
        <slot />
      </div>
    </main>
    <div
      v-if="!isActivityPage"
      class="activity-rail"
      :class="{ 'activity-rail-open': settingsStore.showActivitySidebar }"
    >
      <button
        v-show="!settingsStore.showActivitySidebar"
        ref="activityToggle"
        class="activity-toggle"
        type="button"
        aria-label="Open activity sidebar"
        aria-controls="group-activity-sidebar"
        :aria-expanded="settingsStore.showActivitySidebar"
        @click="openActivitySidebar"
      >
        <span class="chevron chevron-left" aria-hidden="true" />
        <span class="activity-toggle-label" aria-hidden="true">Activity</span>
      </button>
    </div>
    <Teleport :to="activityPageTarget" :disabled="!activityPageTarget">
      <ActivityFeed
        ref="activityFeed"
        id="group-activity-sidebar"
        v-show="isActivityPage || settingsStore.showActivitySidebar"
        :collapsible="!isActivityPage"
        :class="isActivityPage ? 'activity-page-feed' : 'activity-dock'"
      />
    </Teleport>
  </div>
</template>
