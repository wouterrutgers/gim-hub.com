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
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import SearchElement from "../search-element/SearchElement.vue";
  import { copyGearscapeItems } from "./gearscape-export";
  import ItemBank from "./ItemBank.vue";
  import ItemPanel from "./ItemPanel.vue";
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
  const filtersExpanded = ref(false);
  const [selectedItemIdentifier, setSelectedItemIdentifier] = useRememberedState({
    key: "bank-selected-item",
    defaultValue: undefined,
  });
  const [anchorItemIdentifier, setAnchorItemIdentifier] = useRememberedState({
    key: "bank-visible-item",
    defaultValue: undefined,
  });
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

  const searchExpression = computed(function getSearchExpression() {
    return parseSearchExpression(searchFilterUserString.value ?? "");
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

      const owners = Member.itemQuantityBreakdown(breakdownByMember, memberFilter.value, containerFilter.value);
      const totalQuantity = owners.reduce(function sumQuantities(total, owner) {
        return total + owner.quantity;
      }, 0);

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
        owners,
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
      Boolean(searchExpression.value) ||
      memberFilter.value.size > 0 ||
      sortCategory.value !== DEFAULT_SORT_CATEGORY ||
      containerFilter.value !== DEFAULT_CONTAINER_FILTER
    );
  });

  const activeFilterCount = computed(function countActiveFilters() {
    return [
      Boolean(searchExpression.value),
      memberFilter.value.size > 0,
      sortCategory.value !== DEFAULT_SORT_CATEGORY,
      containerFilter.value !== DEFAULT_CONTAINER_FILTER,
    ].filter(Boolean).length;
  });
  const selectedItem = computed(function getSelectedItem() {
    return sortedItems.value.find(function isSelected(item) {
      return item.itemID === selectedItemIdentifier.value;
    });
  });

  watch(
    [
      sortedItems,
      function groupIsLoaded() {
        return groupStore.loaded;
      },
    ],
    function keepSelectionInResults([items, loaded]) {
      if (!loaded) {
        return;
      }

      if (
        !items.some(function isSelected(item) {
          return item.itemID === selectedItemIdentifier.value;
        })
      ) {
        setSelectedItemIdentifier(undefined);
      }
    },
    { immediate: true },
  );

  function selectItem(identifier) {
    setSelectedItemIdentifier(selectedItemIdentifier.value === identifier ? undefined : identifier);
  }

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

  function splitSearchExpression(value, separator) {
    const parts = [];
    let start = 0;
    let bracketDepth = 0;
    let quoted = false;

    for (let index = 0; index < value.length; index++) {
      const character = value[index];

      if (character === '"') {
        quoted = !quoted;
      } else if (!quoted && character === "[") {
        bracketDepth++;
      } else if (!quoted && character === "]" && bracketDepth > 0) {
        bracketDepth--;
      } else if (!quoted && bracketDepth === 0 && character === separator) {
        parts.push(value.slice(start, index));
        start = index + 1;
      }
    }

    parts.push(value.slice(start));

    return parts;
  }

  function parseSearchExpression(value) {
    const searchValue = value.trim().toLocaleLowerCase();

    if (searchValue.length === 0 || searchValue === "-") {
      return undefined;
    }

    const alternatives = splitSearchExpression(searchValue, "|");

    if (alternatives.length > 1) {
      const expressions = alternatives.map(parseSearchExpression).filter(Boolean);

      return expressions.length > 1 ? { type: "Or", expressions } : expressions[0];
    }

    const requirements = splitSearchExpression(searchValue, "&");

    if (requirements.length > 1) {
      const expressions = requirements.map(parseSearchExpression).filter(Boolean);

      return expressions.length > 1 ? { type: "And", expressions } : expressions[0];
    }

    if (searchValue.startsWith("-[") && searchValue.endsWith("]")) {
      const expression = parseSearchExpression(searchValue.slice(2, -1));

      return expression ? { type: "Not", expression } : undefined;
    }

    if (searchValue.startsWith("[") && searchValue.endsWith("]")) {
      return parseSearchExpression(searchValue.slice(1, -1));
    }

    const excluded = searchValue.startsWith("-");
    const term = excluded ? searchValue.slice(1) : searchValue;
    const exact = term.startsWith('"') && term.endsWith('"');

    if (exact) {
      return term.length > 2 ? { type: "Name", lowercase: term.slice(1, -1), exact: true, excluded } : undefined;
    }

    const splitForTag = term.split(":");

    if (splitForTag.length === 1 || splitForTag[0] !== "tag") {
      return { type: "Name", lowercase: term, exact: false, excluded };
    }

    const suffix = splitForTag.slice(1).join(":");
    let bitmask = 0n;

    for (const [tag, bitIndex] of gameDataStore.gameData.itemTags?.tags ?? []) {
      if (tag.toLocaleLowerCase() === suffix) {
        bitmask += 1n << BigInt(bitIndex);
      }
    }

    return { type: "Tag", bitmask, excluded };
  }

  function matchesSearchExpression(expression, itemID, itemLowercase, itemTags) {
    if (expression.type === "Or") {
      return expression.expressions.some(function matchesAlternative(alternative) {
        return matchesSearchExpression(alternative, itemID, itemLowercase, itemTags);
      });
    }

    if (expression.type === "And") {
      return expression.expressions.every(function matchesRequirement(requirement) {
        return matchesSearchExpression(requirement, itemID, itemLowercase, itemTags);
      });
    }

    if (expression.type === "Not") {
      return !matchesSearchExpression(expression.expression, itemID, itemLowercase, itemTags);
    }

    let matches;

    if (expression.type === "Name") {
      matches = expression.exact
        ? expression.lowercase === itemLowercase
        : itemLowercase.includes(expression.lowercase);
    } else {
      matches = (expression.bitmask & (itemTags?.items[itemID] ?? 0n)) !== 0n;
    }

    return expression.excluded ? !matches : matches;
  }

  function itemMatchesSearch(itemID, itemDatum, itemTags) {
    if (!searchExpression.value) {
      return true;
    }

    return matchesSearchExpression(searchExpression.value, itemID, itemDatum.name.toLocaleLowerCase(), itemTags);
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

  <LoadingScreen v-if="!groupStore.loaded" />
  <div v-else-if="groupStore.items.size <= 0" id="items-page-no-items" class="rsborder rsbackground">
    <h3>Your group has no recorded items!</h3>
    <p>
      Either no members have logged in with the plugin, or there is an issue. Please double check that the names in the
      <RouterLink to="../settings" class="orange-link">settings</RouterLink> page
      <span class="emphasize">exactly</span> match your group members' in-game display names.
    </p>
  </div>

  <template v-else>
    <div class="items-toolbar">
      <div class="items-summary" aria-label="Item totals for current filters">
        <div>
          <span>Grand Exchange value</span>
          <strong>{{ itemAggregates.totalGEPrice.toLocaleString() }} <small>gp</small></strong>
        </div>
        <div>
          <span>High alch value</span>
          <strong>{{ itemAggregates.totalHighAlch.toLocaleString() }} <small>gp</small></strong>
        </div>
      </div>

      <div id="items-page-head">
        <SearchElement
          id="items-page-search"
          placeholder="Search your group's items…"
          :value="searchFilterUserString ?? ''"
          :default-value="searchFilterUserString"
          @change="setSearchFilterUserString"
        />
        <button
          id="items-page-filters-button"
          class="men-button"
          type="button"
          :aria-expanded="filtersExpanded"
          aria-controls="items-page-filters"
          @click="filtersExpanded = !filtersExpanded"
        >
          Filters{{ activeFilterCount ? ` (${activeFilterCount})` : "" }}
          <span class="chevron" :class="{ 'chevron-up': filtersExpanded }" aria-hidden="true" />
        </button>
      </div>

      <div id="items-page-filters" class="items-page-utility" :class="{ 'filters-expanded': filtersExpanded }">
        <div class="items-filter-actions">
          <button
            v-if="hasActiveFilters"
            id="items-page-reset-filters-button"
            class="men-button"
            data-tooltip="Reset all filters to default"
            aria-label="Reset all filters to default"
            @click="resetFilters"
          >
            <CachedImage alt="" src="/ui/1731-0.png" />
            Reset
          </button>
          <button id="items-page-tutorial-button" class="men-button" @click="openTutorialModal()">
            <CachedImage alt="" src="/ui/1094-0.png" />
            Search help
          </button>
        </div>

        <div class="items-filter-fields">
          <label class="items-filter-label">
            Sort by
            <span class="select-container">
              <select aria-label="Sort items" :value="sortCategory" @change="setSortCategory($event.target.value)">
                <option v-for="category in ItemSortCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </span>
          </label>
          <label class="items-filter-label">
            Storage
            <span class="select-container">
              <select
                aria-label="Item container"
                :value="containerFilter"
                @change="setContainerFilter(validateContainerFilter($event.target.value))"
              >
                <option v-for="name in ['All', ...Member.itemContainerNames]" :key="name" :value="name">
                  {{ name === "All" ? "All storage" : name }}
                </option>
              </select>
            </span>
          </label>
          <div class="items-page-member-filter-clipbox" role="group" aria-label="Include group members">
            <span class="items-filter-caption">Include members</span>
            <span class="items-page-member-filter-container">
              <span v-for="name in groupStore.memberNames" :key="name">
                <input
                  :id="`items-page-member-filter-${name}`"
                  type="checkbox"
                  :checked="!memberFilter.has(name)"
                  @change="toggleMember(name)"
                />
                <label :for="`items-page-member-filter-${name}`">
                  <span aria-hidden="true">
                    <PlayerIcon v-if="name !== '@SHARED'" :name="name" />
                    <CachedImage v-else src="/ui/777-0.png" alt="" width="14" height="15" />
                  </span>
                  {{ name === "@SHARED" ? "Shared" : name }}
                </label>
              </span>
            </span>
          </div>
        </div>

        <div v-if="settingsStore.enableGearscapeExport" class="items-results-actions">
          <button
            id="items-page-gearscape-export-button"
            class="men-button men-button-small"
            data-tooltip="Copy only the currently filtered items to the clipboard for importing into Gearscape"
            aria-label="Copy current items to clipboard for Gearscape"
            @click="copyItemsForGearscape"
          >
            {{ gearscapeExportLabel }}
          </button>
        </div>
      </div>

      <div class="items-results-heading">
        <h2>
          Group bank <span>{{ itemAggregates.filteredItems.length.toLocaleString() }} items</span>
        </h2>
        <div class="items-view-toggle" role="group" aria-label="Item display">
          <button
            type="button"
            class="men-button men-button-small"
            :class="{ active: !settingsStore.showItemOwners }"
            :aria-pressed="!settingsStore.showItemOwners"
            @click="settingsStore.setShowItemOwners(false)"
          >
            Compact
          </button>
          <button
            type="button"
            class="men-button men-button-small"
            :class="{ active: settingsStore.showItemOwners }"
            :aria-pressed="settingsStore.showItemOwners"
            @click="settingsStore.setShowItemOwners(true)"
          >
            Detailed
          </button>
        </div>
      </div>
    </div>

    <p v-if="sortedItems.length === 0" class="items-empty">
      No items match these filters. Try another search or reset your filters.
    </p>

    <ItemBank
      :key="settingsStore.showItemOwners"
      :sorted-items="sortedItems"
      :pinned-items="pinnedItems"
      :selected-item-identifier="selectedItemIdentifier"
      :show-owners="settingsStore.showItemOwners"
      :member-filter="memberFilter"
      :container-filter="containerFilter"
      :anchor-item-identifier="anchorItemIdentifier"
      @select-item="selectItem"
      @toggle-pin="togglePin"
      @remember-item="setAnchorItemIdentifier"
    />

    <section
      v-if="!settingsStore.showItemOwners && selectedItem"
      id="selected-item-details"
      class="item-inspector"
      aria-label="Selected item details"
    >
      <ItemPanel
        :item-name="selectedItem.itemName"
        :item-i-d="selectedItem.itemID"
        :high-alch-per="selectedItem.highAlch"
        :alchable="selectedItem.alchable"
        :ge-price-per="selectedItem.gePrice"
        :image-u-r-l="selectedItem.imageURL"
        :total-quantity="selectedItem.totalQuantity"
        :member-filter="memberFilter"
        :container-filter="containerFilter"
        :quantities="selectedItem.breakdownByMember"
        :is-pinned="pinnedItems.has(selectedItem.itemID)"
        @toggle-pin="togglePin"
      />
    </section>
    <p v-else-if="!settingsStore.showItemOwners && sortedItems.length > 0" class="item-selection-hint">
      Select an item to see its owners and value.
    </p>
  </template>
</template>
