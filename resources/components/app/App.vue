<script setup>
  import { computed, defineAsyncComponent, watch } from "vue";
  import { useRoute } from "vue-router";
  import { applySiteTheme } from "../../game/theme";
  import { useSettingsStore } from "../../stores/settings";
  import AuthedLayout from "../layout/AuthedLayout.vue";
  import UnauthedLayout from "../layout/UnauthedLayout.vue";
  import Tooltip from "../tooltip/Tooltip.vue";
  import "./app.css";

  const CanvasMap = defineAsyncComponent(function loadCanvasMap() {
    return import("../canvas-map/CanvasMap.vue");
  });

  const route = useRoute();
  const settingsStore = useSettingsStore();

  const canvasMapIsInteractive = computed(function canvasMapIsInteractive() {
    return route.path === "/group/map";
  });

  watch(
    [
      function getLayout() {
        return route.meta.layout;
      },
      function getSiteTheme() {
        return settingsStore.siteTheme;
      },
    ],
    function updateTheme([layout, siteTheme]) {
      if (layout === "authed") {
        applySiteTheme(siteTheme);
      }
    },
    { immediate: true },
  );
</script>

<template>
  <CanvasMap :interactive="canvasMapIsInteractive" />

  <RouterView v-slot="{ Component }">
    <AuthedLayout
      v-if="route.meta.layout === 'authed'"
      :show-panels="route.meta.showPanels"
      :hide-header="route.meta.hideHeader"
    >
      <component :is="Component" />
    </AuthedLayout>

    <UnauthedLayout v-else-if="route.meta.layout === 'unauthed'">
      <component :is="Component" />
    </UnauthedLayout>

    <component :is="Component" v-else />
  </RouterView>

  <Tooltip />
</template>
