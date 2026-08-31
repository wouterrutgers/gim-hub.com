<script setup>
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import { useSettingsStore } from "../../stores/settings";
  import AppNavigation from "../app-navigation/AppNavigation.vue";
  import GroupChatPanel from "../group-chat-panel/GroupChatPanel.vue";
  import SidePanels from "./SidePanels.vue";
  import "./layout.css";

  const props = defineProps({
    showPanels: { type: Boolean, default: false },
    hideHeader: { type: Boolean, default: false },
  });

  const apiStore = useApiStore();
  const settingsStore = useSettingsStore();
  const route = useRoute();

  const groupName = computed(function getGroupName() {
    return apiStore.credentials?.name ?? "";
  });

  const showChatPanel = computed(function getChatPanelVisibility() {
    return settingsStore.chatPanelPages.includes(route.path);
  });
</script>

<template>
  <template v-if="settingsStore.sidebarPosition === 'right'">
    <div id="main-content" class="pointer-passthrough">
      <AppNavigation v-if="!props.hideHeader" :group-name="groupName" />
      <slot />
      <GroupChatPanel v-if="showChatPanel" />
    </div>
    <SidePanels v-if="props.showPanels" />
  </template>

  <template v-else>
    <SidePanels v-if="props.showPanels" />
    <div id="main-content" class="pointer-passthrough">
      <AppNavigation v-if="!props.hideHeader" :group-name="groupName" />
      <slot />
      <GroupChatPanel v-if="showChatPanel" />
    </div>
  </template>
</template>
