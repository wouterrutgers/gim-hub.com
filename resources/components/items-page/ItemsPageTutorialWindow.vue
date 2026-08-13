<script setup>
  import { ref } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import ItemPanel from "./ItemPanel.vue";

  const emit = defineEmits(["close"]);

  const gameDataStore = useGameDataStore();

  const pinned = ref(true);
  const tutorialQuantities = new Map([["Zezima", { Total: 100, Bank: 100, Inventory: 15 }]]);

  function togglePin() {
    pinned.value = !pinned.value;
  }
</script>

<template>
  <div class="items-page-tutorial-window rsborder rsbackground">
    <div class="items-page-tutorial-window-header">
      <button data-tooltip="Close dialog" @click="emit('close')">
        <CachedImage src="/ui/1731-0.png" alt="Close dialog" />
      </button>
    </div>
    <div class="items-page-tutorial-window-body">
      <h2>Searching for items</h2>
      <p>Type in the 'Search' box to search item names, and display only the items that match.</p>
      <p>
        The match is not exact, unless the phrase is surrounded by double quotes. For example, searching
        <span class="items-page-tutorial-inline-search">coal</span> will display both the OSRS items
        <b class="items-page-tutorial-inline-item-name">Coal</b> and
        <b class="items-page-tutorial-inline-item-name">Coal bag</b>, while searching instead
        <span class="items-page-tutorial-inline-search">"coal"</span> will display only
        <b class="items-page-tutorial-inline-item-name">Coal</b>. Searches are never case-sensitive.
      </p>
      <p>
        You can combine searches separated with vertical bars to search for items that match any of the searches. For
        example, <span class="items-page-tutorial-inline-search">whip | coal</span> will display both
        <b class="items-page-tutorial-inline-item-name">Abyssal Whip</b> and
        <b class="items-page-tutorial-inline-item-name">Coal bag</b> (among other items).
      </p>
      <p>
        Type <span class="items-page-tutorial-inline-search">tag:</span> followed by an exact tag to search by category
        of item instead of name. The following tags are available, with some entries being aliases that contain the same
        items:
      </p>
      <div class="items-page-tutorial-tags rsborder-tiny">
        <span v-for="[tag] in gameDataStore.gameData.itemTags?.tags ?? []" :key="tag">{{ tag }}</span>
      </div>
      <h2>Item breakdown</h2>
      <ItemPanel
        container-filter="All"
        :ge-price-per="200"
        :high-alch-per="100"
        :alchable="true"
        image-u-r-l="/item-icons/4323.webp"
        :is-pinned="pinned"
        :item-i-d="4323"
        item-name="Team-5 cape"
        :member-filter="new Set()"
        :quantities="tutorialQuantities"
        :total-quantity="115"
        @toggle-pin="togglePin"
      />
      <ul>
        <li>
          Hover over the numbers to see detailed tooltips, including a breakdown of where items are for each member.
        </li>
        <li>
          Hover over the upper right of the panel and click the star (★) to pin the item, causing it to appear before
          all other items regardless of sorting order.
        </li>
        <li>The name is an interactive link that leads to the item's page on the official OSRS wiki.</li>
      </ul>
    </div>
  </div>
</template>
