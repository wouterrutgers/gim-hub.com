<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
  import { useMapStore } from "../../stores/map";
  import "../search-element/search-element.css";

  const mapStore = useMapStore();
  const search = ref(null);
  const suggestionList = ref(null);
  const query = ref("");
  const isOpen = ref(false);
  const activeIndex = ref(0);

  const nameCounts = computed(function countLocationNames() {
    const counts = new Map();
    for (const location of mapStore.locations) {
      const name = location.name.toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  });

  const suggestions = computed(function getSuggestions() {
    const searchText = query.value.trim().toLowerCase();
    if (!searchText) {
      return [];
    }

    function matchRank(location) {
      const name = location.name.toLowerCase();
      return name === searchText ? 0 : name.startsWith(searchText) ? 1 : 2;
    }

    return mapStore.locations
      .filter(function matchesLocation(location) {
        return location.name.toLowerCase().includes(searchText);
      })
      .sort(function compareLocations(first, second) {
        return matchRank(first) - matchRank(second) || first.name.localeCompare(second.name);
      })
      .slice(0, 8);
  });

  const showSuggestions = computed(function shouldShowSuggestions() {
    return isOpen.value && query.value.trim().length > 0;
  });

  function changeQuery(event) {
    query.value = event.target.value;
    activeIndex.value = 0;
    isOpen.value = true;
    mapStore.clearSelectedLocation();
  }

  function selectLocation(location) {
    query.value = location.name;
    activeIndex.value = 0;
    isOpen.value = false;
    mapStore.selectLocation(location);
  }

  async function handleKeydown(event) {
    if (event.key === "Escape") {
      isOpen.value = false;
      return;
    }

    if (event.key === "Enter" && showSuggestions.value && suggestions.value.length > 0) {
      event.preventDefault();
      selectLocation(suggestions.value[activeIndex.value]);
      return;
    }

    if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || suggestions.value.length === 0) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeIndex.value = isOpen.value
      ? (activeIndex.value + direction + suggestions.value.length) % suggestions.value.length
      : event.key === "ArrowDown"
        ? 0
        : suggestions.value.length - 1;
    isOpen.value = true;
    await nextTick();
    suggestionList.value.children[activeIndex.value].scrollIntoView({ block: "nearest" });
  }

  function closeOutside(event) {
    if (!search.value.contains(event.target)) {
      isOpen.value = false;
    }
  }

  function handleFocusout(event) {
    if (!search.value.contains(event.relatedTarget)) {
      isOpen.value = false;
    }
  }

  onMounted(function listenForOutsidePointer() {
    document.addEventListener("pointerdown", closeOutside);
  });

  onBeforeUnmount(function cleanupSearch() {
    document.removeEventListener("pointerdown", closeOutside);
    mapStore.clearSelectedLocation();
  });
</script>

<template>
  <div ref="search" class="canvas-map-search" @focusout="handleFocusout">
    <input
      class="search-element-input"
      type="text"
      role="combobox"
      aria-label="Search map"
      aria-autocomplete="list"
      aria-controls="canvas-map-suggestions"
      :aria-expanded="showSuggestions"
      :aria-activedescendant="
        showSuggestions && suggestions.length > 0 ? `canvas-map-suggestion-${activeIndex}` : undefined
      "
      autocomplete="off"
      spellcheck="false"
      placeholder="Search map"
      :disabled="!mapStore.renderer"
      :value="query"
      @input="changeQuery"
      @focus="isOpen = true"
      @keydown="handleKeydown"
    />
    <div v-if="showSuggestions" class="canvas-map-search-dropdown rsborder-tiny rsbackground">
      <ul id="canvas-map-suggestions" ref="suggestionList" role="listbox" aria-label="Map locations">
        <li v-for="(location, index) in suggestions" :key="location.labelID" role="presentation">
          <button
            :id="`canvas-map-suggestion-${index}`"
            type="button"
            role="option"
            :aria-selected="index === activeIndex"
            tabindex="-1"
            @pointermove="activeIndex = index"
            @mousedown.prevent
            @click="selectLocation(location)"
          >
            <span>{{ location.name }}</span>
            <small v-if="nameCounts.get(location.name.toLowerCase()) > 1">
              X: {{ location.worldPosition.x }}, Y: {{ -location.worldPosition.y }}, plane: {{ location.plane + 1 }}
            </small>
          </button>
        </li>
      </ul>
      <div v-if="suggestions.length === 0" class="canvas-map-search-empty" role="status">No locations found</div>
    </div>
  </div>
</template>
