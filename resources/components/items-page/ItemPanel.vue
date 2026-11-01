<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import * as Member from "../../game/member";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";

  const props = defineProps({
    itemName: { type: String, required: true },
    itemID: { type: Number, required: true },
    highAlchPer: { type: Number, required: true },
    alchable: { type: Boolean, required: true },
    gePricePer: { type: Number, required: true },
    imageURL: { type: String, required: true },
    totalQuantity: { type: Number, required: true },
    memberFilter: { type: Set, required: true },
    containerFilter: { type: String, required: true },
    quantities: { type: Map, required: true },
    isPinned: { type: Boolean, required: true },
    detailed: { type: Boolean, default: false },
  });
  const groupStore = useGroupStore();
  const emit = defineEmits(["togglePin"]);

  const quantityBreakdown = computed(function getQuantityBreakdown() {
    return [...props.quantities]
      .filter(function memberIsVisible([name]) {
        return !props.memberFilter.has(name);
      })
      .map(function sumMemberQuantity([name, breakdown]) {
        let quantity = 0;

        for (const itemContainer of Member.itemContainerNames) {
          if (props.containerFilter === "All" || props.containerFilter === itemContainer) {
            quantity += breakdown[itemContainer] ?? 0;
          }
        }

        return { name, quantity, breakdown };
      })
      .filter(function hasQuantity({ quantity }) {
        return quantity > 0;
      })
      .map(function prepareBreakdown({ name, quantity, breakdown }) {
        return {
          name,
          quantity,
          tooltip: ["All", "STASH units", "Cargo holds"].includes(props.containerFilter)
            ? serializeTooltip({
                type: "item-breakdown",
                name,
                filter: props.containerFilter,
                breakdown,
                stashLocations: Member.stashItemLocations(
                  groupStore.memberStates.get(name)?.stashUnits ?? new Map(),
                  props.itemID,
                ),
                cargoHolds: Member.cargoHoldLocations(
                  groupStore.memberStates.get(name)?.cargoHolds ?? new Map(),
                  props.itemID,
                ),
              })
            : undefined,
        };
      });
  });

  const highAlch = computed(function getHighAlch() {
    return props.highAlchPer * props.totalQuantity;
  });
  const gePrice = computed(function getGrandExchangePrice() {
    return props.gePricePer * props.totalQuantity;
  });
  const wikiLink = computed(function getWikiLink() {
    return `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${props.itemID}`;
  });
  const pinLabel = computed(function getPinLabel() {
    return props.isPinned ? "Unpin item" : "Pin item to top";
  });
  const highAlchTooltip = computed(function getHighAlchTooltip() {
    return props.alchable
      ? serializeTooltip({ type: "item-price", perPiecePrice: props.highAlchPer, quantity: props.totalQuantity })
      : undefined;
  });
  const grandExchangeTooltip = computed(function getGrandExchangeTooltip() {
    return props.gePricePer > 0
      ? serializeTooltip({ type: "item-price", perPiecePrice: props.gePricePer, quantity: props.totalQuantity })
      : undefined;
  });
</script>

<template>
  <div class="items-page-panel rsborder rsbackground">
    <div class="items-page-panel-top">
      <CachedImage
        loading="lazy"
        class="items-page-panel-icon"
        :alt="props.itemName ?? 'An unknown item'"
        :src="props.imageURL"
      />
      <div class="items-page-panel-heading">
        <a class="items-page-panel-name" :href="wikiLink" target="_blank" rel="noopener noreferrer">
          {{ props.itemName }}
        </a>
        <span v-if="props.detailed" class="items-page-panel-total"
          >{{ props.totalQuantity.toLocaleString() }} total</span
        >
      </div>
      <button
        type="button"
        :class="['items-page-panel-pin-button', { pinned: props.isPinned }]"
        :data-tooltip="pinLabel"
        :aria-label="pinLabel"
        @click="emit('togglePin', props.itemID)"
      >
        {{ props.isPinned ? "★" : "☆" }}
      </button>
    </div>
    <div class="items-page-panel-quantity-breakdown">
      <template v-for="breakdown in quantityBreakdown" :key="breakdown.name">
        <span class="item-owner" :data-tooltip="breakdown.tooltip" :tabindex="breakdown.tooltip ? 0 : undefined">
          <PlayerIcon v-if="breakdown.name !== '@SHARED'" :name="breakdown.name" />
          <CachedImage v-else src="/ui/777-0.png" alt="Shared storage" width="14" height="15" />
          {{ breakdown.name === "@SHARED" ? "Shared" : breakdown.name }}
        </span>
        <span class="item-owner-quantity" :data-tooltip="breakdown.tooltip">{{
          breakdown.quantity.toLocaleString()
        }}</span>
      </template>
    </div>
    <div class="items-page-panel-item-details">
      <template v-if="!props.detailed">
        <span>Quantity</span>
        <span>{{ props.totalQuantity.toLocaleString() }}</span>
      </template>
      <span>High alch</span>
      <span :data-tooltip="highAlchTooltip" :tabindex="highAlchTooltip ? 0 : undefined">
        {{ props.alchable ? `${highAlch.toLocaleString()}gp` : "n/a" }}
      </span>
      <span>GE price</span>
      <span :data-tooltip="grandExchangeTooltip" :tabindex="grandExchangeTooltip ? 0 : undefined">
        {{ props.gePricePer > 0 ? `${gePrice.toLocaleString()}gp` : "n/a" }}
      </span>
    </div>
  </div>
</template>
