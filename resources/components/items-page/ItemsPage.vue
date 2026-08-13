<script setup>
  import { computed, ref, watch } from "vue";
  import * as Member from "../../game/member";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { composeItemIconHref, mappedAlchable, mappedGEPrice, mappedHighAlch } from "../../game/items";
  import { useLocalStorage } from "../../composables/local-storage";
  import { useRememberedState } from "../../composables/remembered-state";
  import CachedImage from "../cached-image/CachedImage.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import SearchElement from "../search-element/SearchElement.vue";
  import { copyGearscapeItems } from "./gearscape-export";
  import ItemPanelsScrollArea from "./ItemPanelsScrollArea.vue";
  import ItemsPageTutorialWindow from "./ItemsPageTutorialWindow.vue";
  import "./items-page.css";

  const ItemSortCategories = [
    "Total quantity",
    "HA total value",
    "HA unit value",
    "GE total price",
    "GE unit price",
    "Alphabetical",
  ];
  const DEFAULT_SORT_CATEGORY = "GE total price";
  const DEFAULT_CONTAINER_FILTER = "All";

  const gameDataStore = useGameDataStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();

  const [searchFilterUserString, setSearchFilterUserString] = useRememberedState({
    key: "search-filter",
    defaultValue: undefined,
  });
  const [memberFilterUserString, setMemberFilterUserString] = useRememberedState({
    key: "items-page-member-filter",
    defaultValue: undefined,
  });
  const [sortCategory, setSortCategory] = useRememberedState({
    key: "items-page-sort-category",
    defaultValue: DEFAULT_SORT_CATEGORY,
  });
  const [containerFilter, setContainerFilter] = useRememberedState({
    key: "item-page-container-filter",
    defaultValue: DEFAULT_CONTAINER_FILTER,
  });
  const [pinnedItemsUserString, setPinnedItemsUserString] = useLocalStorage({
    key: "pinned-items",
    defaultValue: "",
    validator: validatePinnedItems,
  });
  const gearscapeExportStatus = ref("idle");
  const {
    open: tutorialModalOpen,
    componentProps: tutorialModalProps,
    openModal: openTutorialModal,
    closeModal: closeTutorialModal,
  } = useModal();

  const pinnedItems = computed(function getPinnedItems() {
    return new Set(
      pinnedItemsUserString.value
        .split(",")
        .filter(function hasIdentifier(identifier) {
          return identifier.length > 0;
        })
        .map(function parseIdentifier(identifier) {
          return Number.parseInt(identifier, 10);
        }),
    );
  });

  const searchParts = computed(function getSearchParts() {
    return (searchFilterUserString.value ?? "")
      .split("|")
      .map(function normalizeSearchPart(searchPart) {
        return searchPart.trim().toLocaleLowerCase();
      })
      .map(function parseSearchPart(searchPart) {
        if (searchPart.length === 0) {
          return { type: "Name", lowercase: "", exact: false };
        }

        const exact = searchPart.startsWith('"') && searchPart.endsWith('"');
        if (exact) {
          return { type: "Name", lowercase: searchPart.slice(1, -1), exact: true };
        }

        const splitForTag = searchPart.split(":");
        if (splitForTag.length === 1 || splitForTag[0] !== "tag") {
          return { type: "Name", lowercase: searchPart, exact: false };
        }

        const suffix = splitForTag.slice(1).join(":").toLocaleLowerCase();
        let bitmask = 0n;
        for (const [tag, bitIndex] of gameDataStore.gameData.itemTags?.tags ?? []) {
          if (tag.toLocaleLowerCase() === suffix) {
            bitmask += 1n << BigInt(bitIndex);
          }
        }

        return { type: "Tag", bitmask };
      })
      .filter(function hasSearchValue(searchPart) {
        return searchPart.type !== "Name" || searchPart.lowercase.length > 0;
      });
  });

  const memberFilter = computed(function getMemberFilter() {
    return new Set(
      (memberFilterUserString.value ?? "").split(",").filter(function isCurrentMember(name) {
        return name.length > 0 && groupStore.memberNames.has(name);
      }),
    );
  });

  const itemAggregates = computed(function getItemAggregates() {
    const aggregates = { totalHighAlch: 0, totalGEPrice: 0, filteredItems: [] };
    const itemData = gameDataStore.gameData.items;
    const grandExchangeData = gameDataStore.gameData.gePrices;
    const itemTags = gameDataStore.gameData.itemTags;

    for (const [itemID, breakdownByMember] of groupStore.items) {
      const itemDatum = itemData?.get(itemID);
      if (!itemDatum || !itemMatchesSearch(itemID, itemDatum, itemTags)) {
        continue;
      }

      const totalQuantity = getFilteredQuantity(breakdownByMember);
      if (totalQuantity <= 0) {
        continue;
      }

      const highAlch = mappedHighAlch(itemID, itemData);
      const alchable = mappedAlchable(itemID, itemData);
      const grandExchangePrice = mappedGEPrice(itemID, grandExchangeData, itemData);
      aggregates.totalHighAlch += totalQuantity * highAlch;
      aggregates.totalGEPrice += totalQuantity * grandExchangePrice;
      aggregates.filteredItems.push({
        itemID,
        itemName: itemDatum.name,
        breakdownByMember,
        totalQuantity,
        gePrice: grandExchangePrice,
        highAlch,
        alchable,
        imageURL: composeItemIconHref({ itemID, quantity: totalQuantity }, itemDatum),
      });
    }

    return aggregates;
  });

  const sortedItems = computed(function getSortedItems() {
    return [...itemAggregates.value.filteredItems].sort(function sortItems(leftItem, rightItem) {
      const leftItemIsPinned = pinnedItems.value.has(leftItem.itemID);
      const rightItemIsPinned = pinnedItems.value.has(rightItem.itemID);

      if (leftItemIsPinned !== rightItemIsPinned) {
        return leftItemIsPinned ? -1 : 1;
      }

      switch (sortCategory.value) {
        case "Total quantity":
          return rightItem.totalQuantity - leftItem.totalQuantity;
        case "HA total value":
          return rightItem.highAlch * rightItem.totalQuantity - leftItem.highAlch * leftItem.totalQuantity;
        case "HA unit value":
          return rightItem.highAlch - leftItem.highAlch;
        case "GE total price":
          return rightItem.gePrice * rightItem.totalQuantity - leftItem.gePrice * leftItem.totalQuantity;
        case "GE unit price":
          return rightItem.gePrice - leftItem.gePrice;
        case "Alphabetical":
          return leftItem.itemName.localeCompare(rightItem.itemName);
      }
    });
  });

  const hasActiveFilters = computed(function filtersAreActive() {
    return (
      searchParts.value.length > 0 ||
      memberFilter.value.size > 0 ||
      sortCategory.value !== DEFAULT_SORT_CATEGORY ||
      containerFilter.value !== DEFAULT_CONTAINER_FILTER
    );
  });

  const gearscapeExportLabel = computed(function getGearscapeExportLabel() {
    return {
      idle: "Copy for Gearscape",
      success: "Copied for Gearscape",
      error: "Copy failed",
    }[gearscapeExportStatus.value];
  });

  function validatePinnedItems(value) {
    return value;
  }

  function validateContainerFilter(value) {
    return value === "All" || Member.itemContainerNames.includes(value) ? value : undefined;
  }

  function itemMatchesSearch(itemID, itemDatum, itemTags) {
    if (searchParts.value.length === 0) {
      return true;
    }

    const itemLowercase = itemDatum.name.toLocaleLowerCase();

    return searchParts.value.some(function matchesSearchPart(searchPart) {
      if (searchPart.type === "Name") {
        return searchPart.exact ? searchPart.lowercase === itemLowercase : itemLowercase.includes(searchPart.lowercase);
      }

      return (searchPart.bitmask & (itemTags?.items[itemID] ?? 0n)) !== 0n;
    });
  }

  function getFilteredQuantity(breakdownByMember) {
    let totalQuantity = 0;

    for (const [name, breakdown] of breakdownByMember) {
      if (memberFilter.value.has(name)) {
        continue;
      }

      for (const itemContainer of Member.itemContainerNames) {
        if (containerFilter.value === "All" || containerFilter.value === itemContainer) {
          totalQuantity += breakdown[itemContainer] ?? 0;
        }
      }
    }

    return totalQuantity;
  }

  function togglePin(itemID) {
    const newPinnedItems = new Set(pinnedItems.value);

    if (newPinnedItems.has(itemID)) {
      newPinnedItems.delete(itemID);
    } else {
      newPinnedItems.add(itemID);
    }

    setPinnedItemsUserString([...newPinnedItems].join(","));
  }

  function toggleMember(name) {
    const newMemberFilter = new Set(memberFilter.value);

    if (newMemberFilter.has(name)) {
      newMemberFilter.delete(name);
    } else {
      newMemberFilter.add(name);
    }

    setMemberFilterUserString([...newMemberFilter].join(","));
  }

  function resetFilters() {
    setSearchFilterUserString(undefined);
    setMemberFilterUserString(undefined);
    setSortCategory(undefined);
    setContainerFilter(undefined);
  }

  async function copyItemsForGearscape() {
    try {
      await copyGearscapeItems(sortedItems.value);
      gearscapeExportStatus.value = "success";
    } catch (reason) {
      console.error("Failed to copy items for Gearscape:", reason);
      gearscapeExportStatus.value = "error";
    }
  }

  watch(
    [
      memberFilterUserString,
      function getMemberNames() {
        return groupStore.memberNames;
      },
    ],
    function removeMissingMembers() {
      const normalizedFilter = [...memberFilter.value].join(",");
      if ((memberFilterUserString.value ?? "") !== normalizedFilter) {
        setMemberFilterUserString(normalizedFilter || undefined);
      }
    },
    { immediate: true },
  );

  watch(gearscapeExportStatus, function resetGearscapeExportStatus(status, _previousStatus, onCleanup) {
    if (status === "idle") {
      return;
    }

    const timeout = window.setTimeout(function resetStatus() {
      gearscapeExportStatus.value = "idle";
    }, 3000);
    onCleanup(function clearResetTimeout() {
      window.clearTimeout(timeout);
    });
  });
</script>

<template>
  <Modal
    :open="tutorialModalOpen"
    :component="ItemsPageTutorialWindow"
    :component-props="tutorialModalProps"
    @close="closeTutorialModal"
  />

  <div v-if="groupStore.items.size <= 0" id="items-page-no-items" class="rsborder rsbackground">
    <h3>Your group has no recorded items!</h3>
    <p>
      Either no members have logged in with the plugin, or there is an issue. Please double check that the names in the
      <RouterLink to="../settings" class="orange-link">settings</RouterLink> page
      <span class="emphasize">exactly</span> match your group members' in-game display names.
    </p>
  </div>

  <template v-else>
    <div id="items-page-head">
      <SearchElement
        id="items-page-search"
        placeholder="Search"
        :value="searchFilterUserString ?? ''"
        :default-value="searchFilterUserString"
        @change="setSearchFilterUserString"
      />
      <button
        v-if="hasActiveFilters"
        id="items-page-reset-filters-button"
        class="men-button"
        data-tooltip="Reset all filters to default"
        aria-label="Reset all filters to default"
        @click="resetFilters"
      >
        <CachedImage alt="Reset filters" src="/ui/1731-0.png" />
        Reset
      </button>
      <button id="items-page-tutorial-button" class="men-button" @click="openTutorialModal()">
        <CachedImage alt="Items tutorial" src="/ui/1094-0.png" />
        Tutorial
      </button>
    </div>

    <div class="items-page-utility">
      <select
        class="rsborder-tiny rsbackground rsbackground-hover"
        :value="sortCategory"
        @change="setSortCategory($event.target.value)"
      >
        <option v-for="category in ItemSortCategories" :key="category" :value="category">
          {{ `Sort: ${category}` }}
        </option>
      </select>
      <select
        class="rsborder-tiny rsbackground rsbackground-hover"
        :value="containerFilter"
        @change="setContainerFilter(validateContainerFilter($event.target.value))"
      >
        <option v-for="name in ['All', ...Member.itemContainerNames]" :key="name" :value="name">{{ name }}</option>
      </select>
      <div class="items-page-member-filter-clipbox rsborder-tiny rsbackground" style="overflow: hidden">
        <span class="items-page-member-filter-container">
          <span v-for="name in groupStore.memberNames" :key="name" class="rsbackground-hover">
            <input
              :id="`items-page-member-filter-${name}`"
              type="checkbox"
              :checked="!memberFilter.has(name)"
              @change="toggleMember(name)"
            />
            <label :for="`items-page-member-filter-${name}`">{{ name }}</label>
          </span>
        </span>
      </div>
    </div>

    <div class="items-page-utility">
      <span class="rsborder-tiny rsbackground rsbackground-hover">
        <span>{{ itemAggregates.filteredItems.length.toLocaleString() }}</span
        >&nbsp;<span>items</span>
      </span>
      <button
        v-if="settingsStore.enableGearscapeExport"
        id="items-page-gearscape-export-button"
        class="men-button men-button-small"
        data-tooltip="Copy only the currently filtered items to the clipboard for importing into Gearscape"
        aria-label="Copy current items to clipboard for Gearscape"
        @click="copyItemsForGearscape"
      >
        {{ gearscapeExportLabel }}
      </button>
      <span class="rsborder-tiny rsbackground rsbackground-hover">
        HA:&nbsp;<span>{{ itemAggregates.totalHighAlch.toLocaleString() }}</span
        ><span>gp</span>
      </span>
      <span class="rsborder-tiny rsbackground rsbackground-hover">
        GE:&nbsp;<span>{{ itemAggregates.totalGEPrice.toLocaleString() }}</span
        ><span>gp</span>
      </span>
    </div>

    <ItemPanelsScrollArea
      :sorted-items="sortedItems"
      :member-filter="memberFilter"
      :container-filter="containerFilter"
      :pinned-items="pinnedItems"
      @toggle-pin="togglePin"
    />
  </template>
</template>
