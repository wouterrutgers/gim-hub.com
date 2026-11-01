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
  const page = computed(function getCurrentPage() {
    return {
      "/group/items": { title: "Group items", description: "Search items across all members and storage." },
      "/group/map": { title: "World map", description: "Live player locations across Gielinor." },
      "/group/history": { title: "Skill history", description: "Compare experience gains by member." },
      "/group/activity": { title: "Group activity", description: "Drops, levels, and completed achievements." },
      "/group/panels": { title: "Group members", description: "Equipment, skills, quests, and collection logs." },
      "/group/settings": { title: "Settings", description: "Group members and display preferences." },
      "/group/setup-instructions": { title: "Plugin setup", description: "Connect GIM hub to RuneLite." },
      "/changelog": { title: "What's new", description: "Updates to the website and plugin." },
    }[route.path];
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
  <div class="authed-layout" :class="{ 'map-workspace': route.path === '/group/map' }">
    <AppNavigation :group-name="groupName" />
    <aside v-if="props.showPanels" class="group-rail" aria-label="Your group">
      <SidePanels />
    </aside>
    <main id="main-content" class="pointer-passthrough">
      <header class="workspace-header">
        <div>
          <h1>{{ page.title }}</h1>
          <p class="workspace-description">{{ page.description }}</p>
        </div>
        <div class="workspace-actions">
          <span v-if="apiStore.isDemo" class="demo-badge">Demo mode</span>
          <button
            v-if="!isActivityPage"
            class="activity-toggle men-button"
            type="button"
            aria-controls="group-activity-sidebar"
            :aria-expanded="settingsStore.showActivitySidebar"
            @click="settingsStore.setShowActivitySidebar(!settingsStore.showActivitySidebar)"
          >
            <span
              class="chevron"
              :class="settingsStore.showActivitySidebar ? 'chevron-right' : 'chevron-left'"
              aria-hidden="true"
            />
            {{ settingsStore.showActivitySidebar ? "Hide activity" : "Show activity" }}
          </button>
          <RouterLink to="/group/activity" class="activity-page-link men-button">Activity</RouterLink>
        </div>
      </header>
      <PluginWarnings />
      <div class="workspace-page pointer-passthrough">
        <slot />
      </div>
    </main>
    <Teleport :to="activityPageTarget" :disabled="!activityPageTarget">
      <ActivityFeed
        id="group-activity-sidebar"
        v-show="isActivityPage || settingsStore.showActivitySidebar"
        :collapsible="!isActivityPage"
        :class="isActivityPage ? 'activity-page-feed' : 'activity-dock'"
      />
    </Teleport>
  </div>
</template>
