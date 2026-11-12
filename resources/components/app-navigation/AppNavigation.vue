<script setup>
  import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
  const windowWidth = ref(window.innerWidth);
  const moreMenu = ref();
  const moreToggle = ref();
  const moreOpen = ref(false);
  const { open: modalOpen, openModal, closeModal } = useModal();

  const navigationCollapsed = computed(function isNavigationCollapsed() {
    return windowWidth.value >= 768 && settingsStore.collapseNavigation;
  });

  const primaryLinks = [
    { label: "Group items", shortLabel: "Items", href: "/group/items", icon: "/ui/777-0.png" },
    { label: "World map", shortLabel: "Map", href: "/group/map", icon: "/ui/world-map.png" },
    { label: "Skill history", shortLabel: "History", href: "/group/history", icon: "/ui/3579-0.png" },
    { label: "Activity", shortLabel: "Activity", href: "/group/activity", icon: "/ui/776-0.png" },
    { label: "Members", shortLabel: "Members", href: "/group/panels", icon: "/ui/friends-list.png" },
  ];

  const secondaryLinks = [
    { label: "Settings", href: "/group/settings", icon: "/ui/785-0.png" },
    { label: "Plugin setup", href: "/group/setup-instructions", icon: "/ui/1094-0.png" },
    { label: "What's new", href: "/changelog", icon: "/item-icons/11169.webp" },
  ];

  function closeMoreOnOutsideClick(event) {
    if (moreOpen.value && !moreMenu.value.contains(event.target)) {
      moreOpen.value = false;
    }
  }

  function closeMoreOnFocusOut(event) {
    if (event.relatedTarget && !moreMenu.value.contains(event.relatedTarget)) {
      moreOpen.value = false;
    }
  }

  function closeMore() {
    moreOpen.value = false;
    moreToggle.value.focus();
  }

  function closeMoreOnEscape(event) {
    if (!moreOpen.value) {
      return;
    }

    event.stopPropagation();
    closeMore();
  }

  function openSupportFromMore() {
    closeMore();
    openModal();
  }

  function updateWindowWidth() {
    windowWidth.value = window.innerWidth;
  }

  onMounted(function listenForOutsidePointer() {
    document.addEventListener("pointerdown", closeMoreOnOutsideClick);
    window.addEventListener("resize", updateWindowWidth);
  });

  onBeforeUnmount(function removeOutsidePointerListener() {
    document.removeEventListener("pointerdown", closeMoreOnOutsideClick);
    window.removeEventListener("resize", updateWindowWidth);
  });
</script>

<template>
  <Modal :open="modalOpen" :component="DonateWindow" @close="closeModal" />

  <aside id="app-navigation" :class="{ 'navigation-collapsed': navigationCollapsed }">
    <div class="nav-header">
      <RouterLink to="/group/items" class="brand" aria-label="GIM hub home">
        <CachedImage class="brand-logo" src="/images/logo-quarter.webp" alt="GIM hub" />
      </RouterLink>
      <button
        type="button"
        class="nav-collapse-toggle"
        :aria-label="navigationCollapsed ? 'Expand menu' : 'Collapse menu'"
        :data-tooltip="navigationCollapsed ? 'Expand menu' : 'Collapse menu'"
        :aria-expanded="!navigationCollapsed"
        aria-controls="app-navigation-nav"
        @click="settingsStore.setCollapseNavigation(!settingsStore.collapseNavigation)"
      >
        <span class="chevron" :class="navigationCollapsed ? 'chevron-right' : 'chevron-left'" aria-hidden="true" />
      </button>
    </div>
    <div class="nav-group">
      <h2 class="nav-section-label">Group</h2>
      <GroupSwitcher
        :group-name="props.groupName"
        :title="navigationCollapsed ? `Switch group: ${props.groupName}` : undefined"
      />
    </div>
    <nav id="app-navigation-nav" aria-label="Group navigation">
      <div class="nav-main-links">
        <AppLink
          v-for="link in primaryLinks"
          :key="link.href"
          :href="link.href"
          :selected="route.path === link.href"
          :aria-label="link.label"
          :data-tooltip="navigationCollapsed ? link.label : undefined"
        >
          <CachedImage alt="" :src="link.icon" width="20" height="20" />
          <span class="nav-label-full">{{ link.label }}</span>
          <span class="nav-label-short">{{ link.shortLabel }}</span>
        </AppLink>
      </div>
      <div ref="moreMenu" class="nav-mobile-more" @focusout="closeMoreOnFocusOut" @keydown.esc="closeMoreOnEscape">
        <button
          ref="moreToggle"
          type="button"
          class="nav-mobile-more-toggle"
          aria-controls="app-navigation-more"
          :aria-expanded="moreOpen"
          :class="{
            active: secondaryLinks.some(function isCurrentLink(link) {
              return route.path === link.href;
            }),
          }"
          @click="moreOpen = !moreOpen"
        >
          More <span class="chevron" aria-hidden="true" />
        </button>
        <div v-show="moreOpen" id="app-navigation-more" class="nav-mobile-menu rsborder rsbackground">
          <AppLink
            v-for="link in secondaryLinks"
            :key="link.href"
            :href="link.href"
            :selected="route.path === link.href"
            @click="closeMore"
          >
            {{ link.label }}
          </AppLink>
          <a
            href="https://discord.gg/ZwzW6yYD8V"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link men-button"
            @click="closeMore"
          >
            Discord
          </a>
          <button class="app-link men-button" type="button" aria-haspopup="dialog" @click="openSupportFromMore">
            <CachedImage class="nav-support-heart" src="/ui/203-0.png" alt="" width="16" height="14" />
            Support the hub
          </button>
        </div>
      </div>
      <div class="nav-secondary-links">
        <h2 class="nav-section-label">Tools</h2>
        <AppLink
          v-for="link in secondaryLinks"
          :key="link.href"
          :href="link.href"
          :selected="route.path === link.href"
          :aria-label="link.label"
          :data-tooltip="navigationCollapsed ? link.label : undefined"
        >
          <CachedImage class="nav-tool-icon" :src="link.icon" alt="" width="20" height="20" />
          <span class="nav-label-full">{{ link.label }}</span>
        </AppLink>
      </div>
    </nav>
    <div class="nav-footer">
      <button
        type="button"
        class="nav-support"
        aria-haspopup="dialog"
        aria-controls="donate-window"
        aria-label="Support the hub"
        :data-tooltip="navigationCollapsed ? 'Support the hub' : undefined"
        :aria-expanded="modalOpen"
        @click="openModal()"
      >
        <CachedImage class="nav-support-heart" src="/ui/203-0.png" alt="" width="16" height="14" />
        <span class="nav-label-full">Support the hub</span>
      </button>
      <div class="nav-community-links">
        <a
          href="https://discord.gg/ZwzW6yYD8V"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
          :data-tooltip="navigationCollapsed ? 'Discord' : undefined"
        >
          <CachedImage class="nav-community-icon" src="/images/discord-light.webp" alt="" width="20" height="20" />
          <span class="nav-label-full">Discord</span>
        </a>
        <a
          href="https://github.com/wouterrutgers/gim-hub.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          :data-tooltip="navigationCollapsed ? 'GitHub' : undefined"
        >
          <CachedImage class="nav-community-icon" src="/images/github-light.webp" alt="" width="20" height="20" />
          <span class="nav-label-full">GitHub</span>
        </a>
      </div>
    </div>
  </aside>
</template>
