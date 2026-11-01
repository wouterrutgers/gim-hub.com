<script setup>
  import { computed, onBeforeUnmount, onMounted, ref } from "vue";
  import { useVirtualizer } from "@tanstack/vue-virtual";
  import { formatShortQuantity } from "../../game/items";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";

  const props = defineProps({
    sortedItems: { type: Array, required: true },
    pinnedItems: { type: Set, required: true },
    selectedItemIdentifier: { type: Number, default: undefined },
    detailsIdentifier: { type: String, default: "selected-item-details" },
  });
  const emit = defineEmits(["selectItem"]);
  const parent = ref();
  const columns = ref(6);
  const resizeObserver = new ResizeObserver(function updateColumns([entry]) {
    columns.value = Math.max(1, Math.floor(entry.contentRect.width / 104));
  });
  const options = computed(function virtualizerOptions() {
    return {
      count: Math.ceil(props.sortedItems.length / columns.value),
      getScrollElement: function getScrollElement() {
        return parent.value;
      },
      estimateSize: function estimateRowSize() {
        return 112;
      },
      overscan: 3,
    };
  });
  const virtualizer = useVirtualizer(options);
  const rows = computed(function visibleRows() {
    return virtualizer.value.getVirtualItems();
  });

  onMounted(function observeBank() {
    resizeObserver.observe(parent.value);
  });
  onBeforeUnmount(function stopObservingBank() {
    resizeObserver.disconnect();
  });

  function itemsForRow(row) {
    return props.sortedItems.slice(row.index * columns.value, (row.index + 1) * columns.value);
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
      transform: `translateY(${row.start}px)`,
    };
  }
</script>

<template>
  <div ref="parent" class="items-scroll-area" role="group" aria-label="Group bank items">
    <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <div v-for="row in rows" :key="row.key" :style="rowStyle(row)">
        <button
          v-for="item in itemsForRow(row)"
          :key="item.itemID"
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
      </div>
    </div>
  </div>
</template>
