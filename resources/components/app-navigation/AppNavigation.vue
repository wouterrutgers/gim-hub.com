<script setup>
  import { ref } from "vue";
  import { useRoute } from "vue-router";
  import { useSettingsStore } from "../../stores/settings";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import GroupSwitcher from "../group-switcher/GroupSwitcher.vue";
  import "./app-navigation.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const route = useRoute();
  const settingsStore = useSettingsStore();
  const moreMenu = ref(null);

  const primaryLinks = [
    { label: "Items", href: "/group/items" },
    { label: "Map", href: "/group/map" },
    { label: "History", href: "/group/history" },
  ];

  const secondaryLinks = [
    { label: "Panels", href: "/group/panels" },
    { label: "Settings", href: "/group/settings" },
  ];

  const communityLinks = [
    {
      label: "GitHub",
      href: "https://github.com/wouterrutgers/gim-hub.com",
      imageSource: "/images/github-light.webp",
    },
    {
      label: "Discord",
      href: "https://discord.gg/ZwzW6yYD8V",
      imageSource: "/images/discord-light.webp",
    },
  ];

  function closeMoreOnOutsideClick(event) {
    if (!moreMenu.value.contains(event.target)) {
      moreMenu.value.open = false;
    }
  }
</script>

<template>
  <div id="app-navigation" class="rsborder-tiny rsbackground">
    <GroupSwitcher :group-name="props.groupName" />
    <nav id="app-navigation-nav" aria-label="Group navigation">
      <div class="nav-main-links">
        <AppLink v-for="link in primaryLinks" :key="link.href" :href="link.href" :selected="route.path === link.href">
          {{ link.label }}
        </AppLink>
      </div>

      <div class="nav-right-links">
        <div class="nav-secondary-links">
          <AppLink
            v-for="link in secondaryLinks"
            :key="link.href"
            :href="link.href"
            :selected="route.path === link.href"
            class="nav-utility"
          >
            {{ link.label }}
          </AppLink>
        </div>

        <details
          ref="moreMenu"
          class="nav-more"
          @mousedown.window="closeMoreOnOutsideClick"
          @keydown.esc="moreMenu.open = false"
        >
          <summary
            :class="[
              'men-button',
              'nav-utility',
              { active: route.path === '/changelog' || route.path === '/group/setup-instructions' },
            ]"
          >
            More <span aria-hidden="true">▾</span>
          </summary>
          <div class="nav-more-menu rsborder rsbackground" @click="moreMenu.open = false">
            <div class="nav-more-secondary">
              <AppLink
                v-for="link in secondaryLinks"
                :key="link.href"
                :href="link.href"
                :selected="route.path === link.href"
              >
                {{ link.label }}
              </AppLink>
            </div>
            <AppLink href="/group/setup-instructions" :selected="route.path === '/group/setup-instructions'">
              Setup
            </AppLink>
            <AppLink href="/changelog" :selected="route.path === '/changelog'">Changelog</AppLink>
            <button
              v-if="route.path !== '/group/panels' && !settingsStore.showActivitySidebar"
              class="activity-restore app-link men-button"
              type="button"
              aria-controls="group-activity-sidebar"
              aria-expanded="false"
              @click="settingsStore.setShowActivitySidebar(true)"
            >
              Show activity
            </button>
          </div>
        </details>
      </div>
    </nav>

    <nav class="nav-community-links" aria-label="Community">
      <a
        v-for="link in communityLinks"
        :key="link.href"
        :href="link.href"
        :aria-label="link.label"
        :data-tooltip="link.label"
        target="_blank"
        rel="noopener noreferrer"
        class="app-link men-button nav-community-link"
      >
        <CachedImage alt="" :src="link.imageSource" height="20" />
      </a>
    </nav>
  </div>
</template>
