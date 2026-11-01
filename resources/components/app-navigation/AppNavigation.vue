<script setup>
  import { ref } from "vue";
  import { useRoute } from "vue-router";
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
  const moreMenu = ref();
  const { open: modalOpen, openModal, closeModal } = useModal();

  const primaryLinks = [
    { label: "Group items", shortLabel: "Items", href: "/group/items", icon: "/ui/777-0.png" },
    { label: "World map", shortLabel: "Map", href: "/group/map", icon: "/ui/world-map.png" },
    { label: "Skill history", shortLabel: "History", href: "/group/history", icon: "/ui/3579-0.png" },
    { label: "Activity", shortLabel: "Activity", href: "/group/activity", icon: "/ui/776-0.png" },
    { label: "Members", shortLabel: "Members", href: "/group/panels", icon: "/ui/grouping.png" },
  ];

  const secondaryLinks = [
    { label: "Settings", href: "/group/settings" },
    { label: "Plugin setup", href: "/group/setup-instructions" },
    { label: "What's new", href: "/changelog" },
  ];

  function closeMoreOnOutsideClick(event) {
    if (!moreMenu.value.contains(event.target)) {
      moreMenu.value.open = false;
    }
  }
</script>

<template>
  <Modal :open="modalOpen" :component="DonateWindow" @close="closeModal" />

  <aside id="app-navigation">
    <RouterLink to="/group/items" class="brand" aria-label="GIM hub home">
      <CachedImage class="brand-logo" src="/images/logo-quarter.webp" alt="GIM hub" />
    </RouterLink>
    <div class="nav-group">
      <h2 class="nav-section-label">Group</h2>
      <GroupSwitcher :group-name="props.groupName" />
    </div>
    <nav id="app-navigation-nav" aria-label="Group navigation">
      <div class="nav-main-links">
        <AppLink v-for="link in primaryLinks" :key="link.href" :href="link.href" :selected="route.path === link.href">
          <CachedImage alt="" :src="link.icon" width="20" height="20" />
          <span class="nav-label-full">{{ link.label }}</span>
          <span class="nav-label-short">{{ link.shortLabel }}</span>
        </AppLink>
      </div>
      <details
        ref="moreMenu"
        class="nav-mobile-more"
        @mousedown.window="closeMoreOnOutsideClick"
        @keydown.esc="moreMenu.open = false"
      >
        <summary
          :class="{
            active: secondaryLinks.some(function isCurrentLink(link) {
              return route.path === link.href;
            }),
          }"
        >
          More <span class="chevron" aria-hidden="true" />
        </summary>
        <div class="nav-mobile-menu rsborder rsbackground" @click.capture="moreMenu.open = false">
          <AppLink
            v-for="link in secondaryLinks"
            :key="link.href"
            :href="link.href"
            :selected="route.path === link.href"
          >
            {{ link.label }}
          </AppLink>
          <button class="app-link men-button" type="button" aria-haspopup="dialog" @click="openModal()">
            <CachedImage class="nav-support-heart" src="/ui/203-0.png" alt="" width="16" height="14" />
            Support the hub
          </button>
        </div>
      </details>
      <div class="nav-secondary-links">
        <h2 class="nav-section-label">Tools</h2>
        <AppLink v-for="link in secondaryLinks" :key="link.href" :href="link.href" :selected="route.path === link.href">
          {{ link.label }}
        </AppLink>
      </div>
    </nav>
    <div class="nav-footer">
      <button
        type="button"
        class="nav-support"
        aria-haspopup="dialog"
        aria-controls="donate-window"
        :aria-expanded="modalOpen"
        @click="openModal()"
      >
        <CachedImage class="nav-support-heart" src="/ui/203-0.png" alt="" width="16" height="14" />
        Support the hub
      </button>
      <div class="nav-community-links">
        <a href="https://discord.gg/ZwzW6yYD8V" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://github.com/wouterrutgers/gim-hub.com" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  </aside>
</template>
