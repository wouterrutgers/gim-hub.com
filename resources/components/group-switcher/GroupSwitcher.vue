<script setup>
  import { computed, onBeforeUnmount, ref, watch } from "vue";
  import { useRouter } from "vue-router";
  import { useApiStore } from "../../stores/api";
  import "./group-switcher.css";

  const props = defineProps({
    groupName: { type: String, required: true },
  });

  const apiStore = useApiStore();
  const router = useRouter();

  const open = ref(false);
  const container = ref(null);

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

  function switchGroup(group) {
    open.value = false;
    apiStore.logInLive(group).catch(function removeInvalidGroup() {
      apiStore.removeSavedGroup(group);
    });
  }

  function removeGroup(group) {
    apiStore.removeSavedGroup(group);
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
  <div id="group-switcher" ref="container">
    <button
      id="group-switcher-toggle"
      type="button"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-controls="group-switcher-dropdown"
      @click="toggle"
    >
      <span id="group-switcher-label">{{ props.groupName }}</span>
      <svg
        id="group-switcher-arrow"
        :class="{ open }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div v-if="open" id="group-switcher-dropdown" class="rsborder rsbackground">
      <div v-for="(group, index) in sortedGroups" :key="`${group.name}-${index}`" class="group-switcher-item">
        <button type="button" class="group-switcher-item-button men-button" @click="switchGroup(group)">
          {{ group.name }}
        </button>
        <button
          type="button"
          class="group-switcher-remove men-button"
          :data-tooltip="`Remove ${group.name}`"
          @click="removeGroup(group)"
        >
          ✕
        </button>
      </div>
      <button type="button" class="group-switcher-add men-button" @click="addGroup">+ Add group</button>
    </div>
  </div>
</template>
