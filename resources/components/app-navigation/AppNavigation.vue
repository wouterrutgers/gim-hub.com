<script setup>
  import { computed } from "vue";
  import { useRoute } from "vue-router";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import GroupSwitcher from "../group-switcher/GroupSwitcher.vue";
  import "./app-navigation.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const route = useRoute();

  const navigationLinks = computed(function getNavigationLinks() {
    return [
      { label: "Items", href: "/group/items", mobileIconSource: "/ui/777-0.png" },
      { label: "Map", href: "/group/map", mobileIconSource: "/ui/1698-0.png" },
      { label: "History", href: "/group/history", mobileIconSource: "/ui/3579-0.png" },
      { label: "Panels", href: "/group/panels", mobileIconSource: "/ui/1707-0.png" },
      { label: "Settings", href: "/group/settings", mobileIconSource: "/ui/785-0.png" },
      { spacer: true },
      {
        label: "GitHub",
        href: "https://github.com/wouterrutgers/gim-hub.com",
        mobileIconSource: "/images/github-light.webp",
        isExternal: true,
      },
      {
        label: "Discord",
        href: "https://discord.gg/ZwzW6yYD8V",
        mobileIconSource: "/images/discord-light.webp",
        isExternal: true,
      },
      { label: "Changelog", href: "/changelog", mobileIconSource: "/ui/2414-0.png" },
      { label: "Setup", href: "/group/setup-instructions", mobileIconSource: "/ui/1094-0.png" },
      { label: "Logout", href: "/logout", mobileIconSource: "/ui/225-0.png" },
    ];
  });
</script>

<template>
  <div id="app-navigation" class="rsborder-tiny rsbackground">
    <GroupSwitcher :group-name="props.groupName" />
    <nav id="app-navigation-nav">
      <template v-for="(link, index) in navigationLinks" :key="link.label ?? index">
        <span v-if="link.spacer" id="app-navigation-spacer" class="desktop" />

        <template v-else>
          <span class="desktop">
            <a
              v-if="link.isExternal"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="app-link men-button pixelated"
            >
              <CachedImage :alt="link.label" :src="link.mobileIconSource" height="20" style="margin-right: 8px" />
              {{ link.label }}
            </a>
            <AppLink v-else :href="link.href" :selected="route.path === link.href">
              {{ link.label }}
            </AppLink>
          </span>

          <span class="mobile">
            <a
              v-if="link.isExternal"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="app-link men-button pixelated"
            >
              <CachedImage :alt="link.label" :src="link.mobileIconSource" />
            </a>
            <AppLink v-else :href="link.href" :selected="route.path === link.href">
              <CachedImage :alt="link.label" :src="link.mobileIconSource" class="pixelated" />
            </AppLink>
          </span>
        </template>
      </template>
    </nav>
  </div>
</template>
