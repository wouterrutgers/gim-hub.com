<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { useMemberInventory, useMemberRunePouch } from "../../stores/group";
  import {
    composeItemIconHref,
    formatShortQuantity,
    formatVeryShortQuantity,
    isRunePouch,
    mappedGEPrice,
    mappedHighAlch,
    quantityColor,
  } from "../../game/items";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./player-inventory.css";

  const props = defineProps({
    member: { type: String, required: true },
  });

  const gameDataStore = useGameDataStore();
  const inventory = useMemberInventory(function getMember() {
    return props.member;
  });
  const runePouch = useMemberRunePouch(function getMember() {
    return props.member;
  });

  const slots = computed(function getInventorySlots() {
    return Array.from({ length: 28 }, function buildSlot(_value, index) {
      const item = inventory.value?.get(index);
      const itemData = item ? gameDataStore.gameData.items?.get(item.itemID) : undefined;

      if (!item || !itemData) {
        return { key: `empty ${index}` };
      }

      const runes = [];
      let tooltipData = {
        type: "item",
        name: itemData.name,
        quantity: item.quantity,
        highAlch: mappedHighAlch(item.itemID, gameDataStore.gameData.items),
        gePrice: mappedGEPrice(item.itemID, gameDataStore.gameData.gePrices, gameDataStore.gameData.items),
      };

      if (isRunePouch(item.itemID) && runePouch.value) {
        let totalHighAlch = 0;
        let totalGePrice = 0;

        for (const [runeId, { quantity }] of runePouch.value) {
          const runeData = gameDataStore.gameData.items?.get(runeId);

          if (!runeData) {
            continue;
          }

          totalGePrice +=
            mappedGEPrice(runeId, gameDataStore.gameData.gePrices, gameDataStore.gameData.items) * quantity;
          totalHighAlch += runeData.highalch * quantity;
          runes.push({
            id: runeId,
            name: runeData.name,
            quantity,
            icon: composeItemIconHref({ itemID: runeId, quantity }, runeData),
          });
        }

        tooltipData = {
          type: "rune-pouch",
          name: itemData.name,
          totalHighAlch,
          totalGePrice,
          runes: runes.map(function getRuneTooltip(rune) {
            return { name: rune.name, quantity: rune.quantity };
          }),
        };
      }

      return {
        key: `${item.itemID} ${item.quantity} ${index} ${runes
          .map(function getRuneKey(rune) {
            return `${rune.id} ${rune.quantity}`;
          })
          .join(" ")}`,
        item,
        icon: composeItemIconHref(item, itemData),
        link: `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`,
        tooltip: serializeTooltip(tooltipData),
        runes,
      };
    });
  });
</script>

<template>
  <div class="player-inventory">
    <div class="player-inventory-background">
      <template v-for="slot in slots" :key="slot.key">
        <a
          v-if="slot.item"
          :href="slot.link"
          class="player-inventory-item-box"
          target="_blank"
          rel="noopener noreferrer"
          :data-tooltip="slot.tooltip"
        >
          <CachedImage alt="osrs item" :src="slot.icon" />
          <span
            v-if="slot.item.quantity > 1"
            class="player-inventory-item-quantity"
            :style="{ color: quantityColor(slot.item.quantity) }"
          >
            {{ formatShortQuantity(slot.item.quantity) }}
          </span>
          <div
            v-if="slot.runes.length > 0"
            :class="['player-inventory-pouch-container', { 'player-inventory-pouch-vertical': slot.runes.length <= 3 }]"
          >
            <div v-for="rune in slot.runes" :key="rune.id" class="player-inventory-pouch-item-box">
              <CachedImage :alt="rune.name" :src="rune.icon" />
              <span class="player-inventory-item-quantity" :style="{ color: quantityColor(rune.quantity) }">
                {{ formatVeryShortQuantity(rune.quantity) }}
              </span>
            </div>
          </div>
        </a>
        <span v-else />
      </template>
    </div>
  </div>
</template>
