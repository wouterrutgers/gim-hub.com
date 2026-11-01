<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
  import { useVirtualizer } from "@tanstack/vue-virtual";
  import { formatShortQuantity } from "../../game/items";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import ItemPanel from "./ItemPanel.vue";

  const props = defineProps({
    sortedItems: { type: Array, required: true },
    pinnedItems: { type: Set, required: true },
    selectedItemIdentifier: { type: Number, default: undefined },
    detailsIdentifier: { type: String, default: "selected-item-details" },
    showOwners: { type: Boolean, default: false },
    memberFilter: { type: Set, required: true },
    containerFilter: { type: String, required: true },
    anchorItemIdentifier: { type: Number, default: undefined },
  });
  const emit = defineEmits(["selectItem", "togglePin", "rememberItem"]);
  const parent = ref();
  const columns = ref(props.showOwners ? 3 : 6);
  const resizeObserver = new ResizeObserver(function updateColumns([entry]) {
    columns.value = Math.max(1, Math.floor(entry.contentRect.width / (props.showOwners ? 280 : 104)));
  });
  const options = computed(function virtualizerOptions() {
    return {
      count: Math.ceil(props.sortedItems.length / columns.value),
      getScrollElement: function getScrollElement() {
        return parent.value;
      },
      estimateSize: function estimateRowSize() {
        return props.showOwners ? 260 : 112;
      },
      overscan: 3,
    };
  });
  const virtualizer = useVirtualizer(options);
  const rows = computed(function visibleRows() {
    return virtualizer.value.getVirtualItems();
  });

  onMounted(function observeBank() {
    columns.value = Math.max(1, Math.floor(parent.value.clientWidth / (props.showOwners ? 280 : 104)));
    resizeObserver.observe(parent.value);
    nextTick(restorePosition);
  });
  onBeforeUnmount(function stopObservingBank() {
    rememberPosition();
    resizeObserver.disconnect();
  });
  watch(columns, restorePosition, { flush: "post" });

  function onScroll() {
    nextTick(function rememberScrollPosition() {
      if (parent.value) {
        rememberPosition();
      }
    });
  }

  function rememberPosition() {
    const firstVisibleRow = rows.value.find(function isVisible(row) {
      return row.end > parent.value.scrollTop;
    });

    if (firstVisibleRow) {
      emit("rememberItem", props.sortedItems[firstVisibleRow.index * columns.value].itemID);
    }
  }

  function restorePosition() {
    const index = props.sortedItems.findIndex(function isAnchor(item) {
      return item.itemID === props.anchorItemIdentifier;
    });

    if (index >= 0) {
      virtualizer.value.scrollToIndex(Math.floor(index / columns.value), { align: "start" });
    }
  }

  function itemsForRow(row) {
    return props.sortedItems.slice(row.index * columns.value, (row.index + 1) * columns.value);
  }

  function measureRow(element) {
    if (element) {
      virtualizer.value.measureElement(element);
    }
  }

  function rowStyle(row) {
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      display: "grid",
      gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`,
      gap: "8px",
      paddingBottom: "8px",
      transform: `translateY(${row.start}px)`,
    };
  }
</script>

<template>
  <div
    ref="parent"
    class="items-scroll-area"
    :class="{ 'items-bank-detailed': props.showOwners }"
    role="group"
    aria-label="Group bank items"
    @scroll="onScroll"
  >
    <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <div v-for="row in rows" :key="row.key" :ref="measureRow" :data-index="row.index" :style="rowStyle(row)">
        <template v-for="item in itemsForRow(row)" :key="item.itemID">
          <ItemPanel
            v-if="props.showOwners"
            detailed
            :item-i-d="item.itemID"
            :image-u-r-l="item.imageURL"
            :total-quantity="item.totalQuantity"
            :high-alch-per="item.highAlch"
            :alchable="item.alchable"
            :ge-price-per="item.gePrice"
            :item-name="item.itemName"
            :member-filter="props.memberFilter"
            :container-filter="props.containerFilter"
            :quantities="item.breakdownByMember"
            :is-pinned="props.pinnedItems.has(item.itemID)"
            @toggle-pin="emit('togglePin', $event)"
          />
          <button
            v-else
            type="button"
            class="bank-item"
            :class="{
              'bank-item-selected': item.itemID === props.selectedItemIdentifier,
              'bank-item-pinned': props.pinnedItems.has(item.itemID),
            }"
            :data-tooltip="item.itemName"
            :aria-label="`${item.itemName}, ${item.totalQuantity.toLocaleString()} total`"
            :aria-pressed="item.itemID === props.selectedItemIdentifier"
            :aria-controls="props.detailsIdentifier"
            @click="emit('selectItem', item.itemID)"
          >
            <span class="bank-item-quantity">{{ formatShortQuantity(item.totalQuantity) }}</span>
            <CachedImage class="bank-item-sprite" :src="item.imageURL" alt="" width="48" />
            <span class="bank-item-owners" aria-hidden="true">
              <span
                v-for="owner in item.owners"
                :key="owner.name"
                :data-tooltip="`${owner.name === '@SHARED' ? 'Shared' : owner.name}: ${owner.quantity.toLocaleString()}`"
              >
                <PlayerIcon v-if="owner.name !== '@SHARED'" :name="owner.name" />
                <CachedImage
                  v-else
                  class="bank-item-shared-icon"
                  src="/ui/777-0.png"
                  alt="Shared storage"
                  width="14"
                  height="15"
                />
              </span>
            </span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
