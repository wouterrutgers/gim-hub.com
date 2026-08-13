<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useSettingsStore } from "../../stores/settings";
  import AppNavigation from "../app-navigation/AppNavigation.vue";
  import SidePanels from "./SidePanels.vue";
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
  <template v-if="settingsStore.sidebarPosition === 'right'">
    <div id="main-content" class="pointer-passthrough">
      <AppNavigation v-if="!props.hideHeader" :group-name="groupName" />
      <slot />
    </div>
    <SidePanels v-if="props.showPanels" />
  </template>

  <template v-else>
    <SidePanels v-if="props.showPanels" />
    <div id="main-content" class="pointer-passthrough">
      <AppNavigation v-if="!props.hideHeader" :group-name="groupName" />
      <slot />
    </div>
  </template>
</template>
