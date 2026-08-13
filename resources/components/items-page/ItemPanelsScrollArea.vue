<script setup>
  import { computed, onBeforeUnmount, onMounted, ref } from "vue";
  import { useVirtualizer } from "@tanstack/vue-virtual";
  import ItemPanel from "./ItemPanel.vue";

  const props = defineProps({
    sortedItems: { type: Array, required: true },
    memberFilter: { type: Set, required: true },
    containerFilter: { type: String, required: true },
    pinnedItems: { type: Set, required: true },
  });
  const emit = defineEmits(["togglePin"]);

  const PANEL_WIDTH_PIXELS = 280;

  const parent = ref(null);
  const child = ref(null);
  const columns = ref(3);

  const virtualizerOptions = computed(function getVirtualizerOptions() {
    return {
      count: Math.ceil(props.sortedItems.length / columns.value),
      getScrollElement: function getScrollElement() {
        return parent.value;
      },
      overscan: 3,
      estimateSize: function estimateRowSize() {
        return 220;
      },
    };
  });
  const itemsVirtualizer = useVirtualizer(virtualizerOptions);

  const virtualRows = computed(function getVirtualRows() {
    return itemsVirtualizer.value.getVirtualItems();
  });
  const totalSize = computed(function getTotalSize() {
    return itemsVirtualizer.value.getTotalSize();
  });

  onMounted(function registerResizeListener() {
    window.addEventListener("resize", updateColumnsFromWidth);
    updateColumnsFromWidth();
  });

  onBeforeUnmount(function removeResizeListener() {
    window.removeEventListener("resize", updateColumnsFromWidth);
  });

  function updateColumnsFromWidth() {
    columns.value = Math.max(1, Math.floor((child.value?.scrollWidth ?? 0) / PANEL_WIDTH_PIXELS));
  }

  function itemsForRow(row) {
    return props.sortedItems.slice(row.index * columns.value, (row.index + 1) * columns.value);
  }

  function rowStyle(row) {
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      transform: `translateY(${row.start - itemsVirtualizer.value.options.scrollMargin}px)`,
      display: "grid",
      gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
    };
  }

  function measureRow(element) {
    if (element) {
      itemsVirtualizer.value.measureElement(element);
    }
  }
</script>

<template>
  <div ref="parent" style="overflow-y: auto; padding-right: 12px">
    <div ref="child" :style="{ height: `${totalSize}px`, width: '100%', position: 'relative' }">
      <div v-for="row in virtualRows" :key="row.key" :ref="measureRow" :data-index="row.index" :style="rowStyle(row)">
        <ItemPanel
          v-for="item in itemsForRow(row)"
          :key="item.itemID"
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
      </div>
    </div>
  </div>
</template>
