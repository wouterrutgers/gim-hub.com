<script setup>
  import { ref } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import ItemBank from "./ItemBank.vue";
  import ItemPanel from "./ItemPanel.vue";

  const emit = defineEmits(["close"]);

  const gameDataStore = useGameDataStore();

  const pinned = ref(true);
  const tutorialItem = {
    itemID: 4323,
    itemName: "Team-5 cape",
    imageURL: "/item-icons/4323.webp",
    totalQuantity: 115,
    owners: [{ name: "Zezima", quantity: 115 }],
  };
  const tutorialQuantities = new Map([["Zezima", { Bank: 100, Inventory: 15 }]]);

  function togglePin() {
    pinned.value = !pinned.value;
  }
</script>

<template>
  <div
    class="items-page-tutorial-window rsborder rsbackground"
    role="dialog"
    aria-modal="true"
    aria-labelledby="items-help-title"
  >
    <div class="items-page-tutorial-window-header">
      <h2 id="items-help-title">Search help</h2>
      <button type="button" class="dialog-close" aria-label="Close dialog" @click="emit('close')" />
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
        Use <span class="items-page-tutorial-inline-search">&amp;</span> to require both searches, and put
        <span class="items-page-tutorial-inline-search">-</span> before a search to exclude its matches. For example,
        <span class="items-page-tutorial-inline-search">coal &amp; -bag</span> finds Coal but not Coal bag. You can also
        exclude exact names or tags, such as <span class="items-page-tutorial-inline-search">-"coal bag"</span> or
        <span class="items-page-tutorial-inline-search">-tag:food</span>. AND applies before OR. Use square brackets to
        group alternatives:
        <span class="items-page-tutorial-inline-search">tag:potions &amp; [(4) | (3) | (2) | (1)]</span>
        shows only potions with one to four doses.
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
      <p>
        Select an item in the bank to see its value and who holds it in the panel below. Hover over a helmet to see the
        owner's name and quantity.
      </p>
      <div class="items-page-tutorial-preview">
        <ItemBank
          :sorted-items="[tutorialItem]"
          :pinned-items="new Set(pinned ? [tutorialItem.itemID] : [])"
          :selected-item-identifier="tutorialItem.itemID"
          details-identifier="search-help-item-details"
        />
        <section id="search-help-item-details" class="item-inspector" aria-label="Example item details">
          <ItemPanel
            container-filter="All"
            :ge-price-per="200"
            :high-alch-per="100"
            :alchable="true"
            :image-u-r-l="tutorialItem.imageURL"
            :is-pinned="pinned"
            :item-i-d="tutorialItem.itemID"
            :item-name="tutorialItem.itemName"
            :member-filter="new Set()"
            :quantities="tutorialQuantities"
            :total-quantity="tutorialItem.totalQuantity"
            @toggle-pin="togglePin"
          />
        </section>
      </div>
      <ul>
        <li>
          Hover over the numbers to see detailed tooltips, including a breakdown of where items are for each member.
        </li>
        <li>
          Use the star beside the selected item's name to pin it. Pinned items stay before other items regardless of
          sorting order.
        </li>
        <li>The name is an interactive link that leads to the item's page on the official OSRS wiki.</li>
      </ul>
    </div>
  </div>
</template>
