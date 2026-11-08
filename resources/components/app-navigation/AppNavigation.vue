<script setup>
  import { computed, ref } from "vue";
  import { useRoute } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import { useSettingsStore } from "../../stores/settings";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import GroupSwitcher from "../group-switcher/GroupSwitcher.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import DonateWindow from "./DonateWindow.vue";
  import "./app-navigation.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const route = useRoute();
  const apiStore = useApiStore();
  const playerPreferencesStore = usePlayerPreferencesStore();
  const settingsStore = useSettingsStore();
  const playerLabel = computed(function getPlayerLabel() {
    return playerPreferencesStore.displayMemberName ?? "Choose your player";
  });
  const moreMenu = ref();
  const { open: modalOpen, openModal, closeModal } = useModal();

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
    if (!moreMenu.value.contains(event.target)) {
      moreMenu.value.open = false;
    }
  }

  function closeMoreOnEscape(event) {
    if (!moreMenu.value.open) {
      return;
    }

    moreMenu.value.open = false;
    event.stopPropagation();
    moreMenu.value.querySelector("summary").focus();
  }
</script>

<template>
  <Modal :open="modalOpen" :component="DonateWindow" @close="closeModal" />

  <aside id="app-navigation" :class="{ 'navigation-collapsed': settingsStore.collapseNavigation }">
    <div class="nav-header">
      <RouterLink to="/group/items" class="brand" aria-label="GIM hub home">
        <CachedImage class="brand-logo" src="/images/logo-quarter.webp" alt="GIM hub" />
      </RouterLink>
      <button
        type="button"
        class="nav-collapse-toggle"
        :aria-label="settingsStore.collapseNavigation ? 'Expand menu' : 'Collapse menu'"
        :data-tooltip="settingsStore.collapseNavigation ? 'Expand menu' : 'Collapse menu'"
        :aria-expanded="!settingsStore.collapseNavigation"
        aria-controls="app-navigation-nav"
        @click="settingsStore.setCollapseNavigation(!settingsStore.collapseNavigation)"
      >
        <span
          class="chevron"
          :class="settingsStore.collapseNavigation ? 'chevron-right' : 'chevron-left'"
          aria-hidden="true"
        />
      </button>
    </div>
    <div class="nav-group">
      <h2 class="nav-section-label">Group</h2>
      <GroupSwitcher
        :group-name="props.groupName"
        :title="settingsStore.collapseNavigation ? `Switch group: ${props.groupName}` : undefined"
      />
      <button
        v-if="!apiStore.isDemo"
        type="button"
        class="nav-player"
        :disabled="playerPreferencesStore.members.length === 0"
        aria-haspopup="dialog"
        aria-controls="player-chooser-window"
        :aria-expanded="playerPreferencesStore.chooserOpen"
        :aria-label="
          playerPreferencesStore.displayMemberName
            ? `Change your player. Current player: ${playerPreferencesStore.displayMemberName}`
            : playerLabel
        "
        :data-tooltip="
          settingsStore.collapseNavigation
            ? playerPreferencesStore.displayMemberName
              ? `Change your player: ${playerPreferencesStore.displayMemberName}`
              : playerLabel
            : undefined
        "
        @click="playerPreferencesStore.openChooser()"
      >
        <PlayerIcon v-if="playerPreferencesStore.displayMemberName" :name="playerPreferencesStore.displayMemberName" />
        <CachedImage v-else src="/ui/player-icon.webp" alt="" width="12" height="15" />
        <span class="nav-player-label">
          <span class="nav-player-caption">Your player</span>
          <span class="nav-player-name">{{ playerLabel }}</span>
        </span>
        <span v-if="playerPreferencesStore.displayMemberName" class="nav-player-change">Change</span>
        <span class="nav-player-short">{{ playerPreferencesStore.displayMemberId ? "You" : "Choose" }}</span>
      </button>
    </div>
    <nav id="app-navigation-nav" aria-label="Group navigation">
      <div class="nav-main-links">
        <AppLink
          v-for="link in primaryLinks"
          :key="link.href"
          :href="link.href"
          :selected="route.path === link.href"
          :aria-label="link.label"
          :data-tooltip="settingsStore.collapseNavigation ? link.label : undefined"
        >
          <CachedImage alt="" :src="link.icon" width="20" height="20" />
          <span class="nav-label-full">{{ link.label }}</span>
          <span class="nav-label-short">{{ link.shortLabel }}</span>
        </AppLink>
      </div>
      <details
        ref="moreMenu"
        class="nav-mobile-more"
        @mousedown.window="closeMoreOnOutsideClick"
        @keydown.esc="closeMoreOnEscape"
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
          <a href="https://discord.gg/ZwzW6yYD8V" target="_blank" rel="noopener noreferrer" class="app-link men-button">
            Discord
          </a>
          <button class="app-link men-button" type="button" aria-haspopup="dialog" @click="openModal()">
            <CachedImage class="nav-support-heart" src="/ui/203-0.png" alt="" width="16" height="14" />
            Support the hub
          </button>
        </div>
      </details>
      <div class="nav-secondary-links">
        <h2 class="nav-section-label">Tools</h2>
        <AppLink
          v-for="link in secondaryLinks"
          :key="link.href"
          :href="link.href"
          :selected="route.path === link.href"
          :aria-label="link.label"
          :data-tooltip="settingsStore.collapseNavigation ? link.label : undefined"
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
        :data-tooltip="settingsStore.collapseNavigation ? 'Support the hub' : undefined"
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
          :data-tooltip="settingsStore.collapseNavigation ? 'Discord' : undefined"
        >
          <CachedImage class="nav-community-icon" src="/images/discord-light.webp" alt="" width="20" height="20" />
          <span class="nav-label-full">Discord</span>
        </a>
        <a
          href="https://github.com/wouterrutgers/gim-hub.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          :data-tooltip="settingsStore.collapseNavigation ? 'GitHub' : undefined"
        >
          <CachedImage class="nav-community-icon" src="/images/github-light.webp" alt="" width="20" height="20" />
          <span class="nav-label-full">GitHub</span>
        </a>
      </div>
    </div>
  </aside>
</template>
