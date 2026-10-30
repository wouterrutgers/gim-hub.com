<script setup>
  import { ref } from "vue";
  import { useRoute } from "vue-router";
  import { useSettingsStore } from "../../stores/settings";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import GroupSwitcher from "../group-switcher/GroupSwitcher.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import DonateWindow from "./DonateWindow.vue";
  import "./app-navigation.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const route = useRoute();
  const settingsStore = useSettingsStore();
  const moreMenu = ref(null);
  const { open: modalOpen, openModal, closeModal } = useModal();

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
      label: "Discord",
      href: "https://discord.gg/ZwzW6yYD8V",
      imageSource: "/images/discord-light.webp",
    },
    {
      label: "GitHub",
      href: "https://github.com/wouterrutgers/gim-hub.com",
      imageSource: "/images/github-light.webp",
    },
  ];

  function closeMoreOnOutsideClick(event) {
    if (!moreMenu.value.contains(event.target)) {
      moreMenu.value.open = false;
    }
  }
</script>

<template>
  <Modal :open="modalOpen" :component="DonateWindow" @close="closeModal" />

  <div id="app-navigation" class="rsborder-tiny rsbackground">
    <GroupSwitcher :group-name="props.groupName" />
    <nav id="app-navigation-nav" aria-label="Group navigation">
      <div class="nav-main-links">
        <AppLink v-for="link in primaryLinks" :key="link.href" :href="link.href" :selected="route.path === link.href">
          {{ link.label }}
        </AppLink>
        <AppLink href="/group/activity" :selected="route.path === '/group/activity'" class="nav-activity-link">
          Activity
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
          </div>
        </details>
      </div>
    </nav>

    <nav class="nav-community-links" aria-label="Community and activity">
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
      <button
        type="button"
        class="app-link men-button nav-community-link"
        aria-label="Support"
        data-tooltip="Support"
        aria-haspopup="dialog"
        aria-controls="donate-window"
        :aria-expanded="modalOpen"
        @click="openModal()"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
          />
        </svg>
      </button>
      <button
        v-if="route.path !== '/group/panels' && route.path !== '/group/activity' && !settingsStore.showActivitySidebar"
        class="activity-restore app-link men-button nav-community-link"
        type="button"
        aria-label="Show activity"
        data-tooltip="Show activity"
        aria-controls="group-activity-sidebar"
        aria-expanded="false"
        @click="settingsStore.setShowActivitySidebar(true)"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16M6 12h6m-3-3 3 3-3 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </nav>
  </div>
</template>
