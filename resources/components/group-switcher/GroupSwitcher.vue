<script setup>
  import { computed, onBeforeUnmount, ref, watch } from "vue";
  import { useRouter } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./group-switcher.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const apiStore = useApiStore();
  const router = useRouter();

  const open = ref(false);
  const container = ref(null);
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

  function toggle() {
    open.value = !open.value;
  }

  function handleClickOutside(event) {
    if (container.value && !container.value.contains(event.target)) {
      open.value = false;
    }
  }

  async function switchGroup(group) {
    pending.value = true;
    error.value = undefined;

    try {
      await apiStore.logInLive(group);
      open.value = false;
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
  <div id="group-switcher" ref="container" @keydown.esc="open = false">
    <button
      id="group-switcher-toggle"
      type="button"
      :aria-expanded="open"
      aria-controls="group-switcher-dropdown"
      @click="toggle"
    >
      <span id="group-switcher-label">{{ props.groupName }}</span>
      <span id="group-switcher-arrow" class="chevron" :class="{ 'chevron-up': open }" aria-hidden="true" />
    </button>

    <div v-if="open" id="group-switcher-dropdown" class="rsborder rsbackground" :aria-busy="pending">
      <div v-for="(group, index) in sortedGroups" :key="`${group.name}-${index}`" class="group-switcher-item">
        <button
          type="button"
          class="group-switcher-item-button men-button"
          :class="{ active: group.name === props.groupName }"
          :title="group.name"
          :disabled="pending"
          @click="switchGroup(group)"
        >
          {{ group.name }}
        </button>
        <button
          type="button"
          class="group-switcher-remove men-button"
          :aria-label="`Remove saved group ${group.name}`"
          :data-tooltip="`Remove saved group ${group.name}`"
          :disabled="pending"
          @click="removeGroup(group)"
        >
          <CachedImage src="/ui/1731-0.png" alt="" width="16" height="16" />
        </button>
      </div>
      <p v-if="error" class="validation-error" role="alert">{{ error }}</p>
      <button type="button" class="group-switcher-add men-button" :disabled="pending" @click="addGroup">
        Add group
      </button>
      <div class="group-switcher-actions">
        <span v-if="pending" role="status">Connecting…</span>
        <AppLink v-else href="/logout" @click="open = false">Log out</AppLink>
      </div>
    </div>
  </div>
</template>
