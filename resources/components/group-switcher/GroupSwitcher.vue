<script setup>
  import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
  import { useRouter } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./group-switcher.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const apiStore = useApiStore();
  const router = useRouter();

  const open = ref(false);
  const container = ref(null);
  const toggleButton = ref();
  const pending = ref(false);
  const error = ref();

  const sortedGroups = computed(function getSortedGroups() {
    return [...apiStore.savedGroups].sort(function sortGroups(left, right) {
      return left.name.localeCompare(right.name);
    });
  });

  onBeforeUnmount(function cleanupOutsideClickListener() {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  async function toggle(event) {
    open.value = !open.value;

    if (open.value && event.detail === 0 && !pending.value) {
      await nextTick();
      focusFirstGroup();
    }
  }

  function focusFirstGroup() {
    container.value.querySelector(".group-switcher-item-button, .group-switcher-add").focus();
  }

  async function openFromKeyboard() {
    open.value = true;

    if (!pending.value) {
      await nextTick();
      focusFirstGroup();
    }
  }

  function closeOnEscape(event) {
    if (!open.value) {
      return;
    }

    open.value = false;
    event.stopPropagation();
    toggleButton.value.focus();
  }

  function closeOnFocusOut(event) {
    if (event.relatedTarget && !container.value.contains(event.relatedTarget)) {
      open.value = false;
    }
  }

  function isCurrentGroup(group) {
    return !apiStore.isDemo && group.name === apiStore.credentials?.name && group.token === apiStore.credentials?.token;
  }

  function handleClickOutside(event) {
    if (container.value && !container.value.contains(event.target)) {
      open.value = false;
    }
  }

  async function switchGroup(group) {
    if (isCurrentGroup(group)) {
      open.value = false;
      toggleButton.value.focus();

      return;
    }

    pending.value = true;
    error.value = undefined;

    try {
      await apiStore.logInLive(group);
      open.value = false;
      toggleButton.value.focus();
    } catch {
      error.value = "Could not switch groups. Please try again.";
    } finally {
      pending.value = false;
    }
  }

  async function removeGroup(group) {
    pending.value = true;

    try {
      await apiStore.removeSavedGroup(group);

      if (!apiStore.client) {
        await router.push("/");
      }
    } finally {
      pending.value = false;
    }
  }

  function addGroup() {
    open.value = false;
    router.push({ path: "/login", query: { addGroup: "true" } });
  }

  watch(open, function updateOutsideClickListener(isOpen) {
    document[isOpen ? "addEventListener" : "removeEventListener"]("mousedown", handleClickOutside);
  });
</script>

<template>
  <div id="group-switcher" ref="container" @keydown.esc="closeOnEscape" @focusout="closeOnFocusOut">
    <button
      id="group-switcher-toggle"
      ref="toggleButton"
      type="button"
      :aria-label="`Switch group: ${props.groupName}`"
      :aria-expanded="open"
      aria-controls="group-switcher-dropdown"
      @click="toggle"
      @keydown.down.prevent="openFromKeyboard"
    >
      <CachedImage class="group-switcher-icon" src="/ui/grouping.png" alt="" width="20" height="20" />
      <span id="group-switcher-label">{{ props.groupName }}</span>
      <span id="group-switcher-arrow" class="chevron" :class="{ 'chevron-up': open }" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      id="group-switcher-dropdown"
      class="rsborder rsbackground"
      role="region"
      aria-label="Switch group"
      :aria-busy="pending"
    >
      <div class="group-switcher-current">
        <span class="group-switcher-caption">Current group</span>
        <strong>{{ props.groupName }}</strong>
        <span v-if="apiStore.isDemo" class="group-switcher-demo">Demo mode</span>
      </div>
      <p id="group-switcher-saved-label" class="group-switcher-caption group-switcher-saved-label">Saved groups</p>
      <ul v-if="sortedGroups.length" class="group-switcher-list" aria-labelledby="group-switcher-saved-label">
        <li
          v-for="(group, index) in sortedGroups"
          :key="`${group.name}-${index}`"
          class="group-switcher-item"
          :class="{ 'group-switcher-item-current': isCurrentGroup(group) }"
        >
          <button
            type="button"
            class="group-switcher-item-button"
            :aria-current="isCurrentGroup(group) ? 'true' : undefined"
            :aria-label="`Switch to group ${group.name}`"
            :disabled="pending"
            @click="switchGroup(group)"
          >
            <span class="group-switcher-name">{{ group.name }}</span>
            <span v-if="isCurrentGroup(group)" class="group-switcher-current-label">Current</span>
          </button>
          <button
            type="button"
            class="group-switcher-remove"
            :aria-label="`Forget saved login for ${group.name}`"
            :data-tooltip="`Forget saved login for ${group.name}`"
            :disabled="pending"
            @click="removeGroup(group)"
          >
            Forget
          </button>
        </li>
      </ul>
      <p v-else class="group-switcher-empty">No saved groups yet.</p>
      <p v-if="error" class="validation-error" role="alert">{{ error }}</p>
      <div class="group-switcher-actions">
        <button type="button" class="group-switcher-add group-switcher-action" :disabled="pending" @click="addGroup">
          Add another group
        </button>
        <span v-if="pending" class="group-switcher-action group-switcher-status" role="status">Connecting…</span>
        <RouterLink v-else to="/logout" class="group-switcher-action group-switcher-logout" @click="open = false">
          {{ apiStore.isDemo ? "Exit demo" : "Log out" }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
