<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { useGroupStore, useMemberInventory, useMemberRunePouch } from "../../stores/group";
  import {
    composeItemIconHref,
    formatShortQuantity,
    formatVeryShortQuantity,
    isRunePouch,
    mappedGEPrice,
    mappedHighAlch,
    quantityColor,
  } from "../../game/items";
  import { portableStorageKey } from "../../game/member";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./player-inventory.css";

  const props = defineProps({
    member: { type: String, required: true },
  });

  const groupStore = useGroupStore();
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

      let storedItems = [];
      let tooltipData = {
        type: "item",
        name: itemData.name,
        quantity: item.quantity,
        highAlch: mappedHighAlch(item.itemID, gameDataStore.gameData.items),
        gePrice: mappedGEPrice(item.itemID, gameDataStore.gameData.gePrices, gameDataStore.gameData.items),
      };

      const storageKey = portableStorageKey(item.itemID);
      if (storageKey) {
        const contents = groupStore.memberStates.get(props.member)?.[storageKey];
        if (contents?.size) {
          storedItems = [...contents.values()].map(function describeStoredItem(storedItem) {
            const storedItemData = gameDataStore.gameData.items?.get(storedItem.itemID);
            return {
              id: storedItem.itemID,
              name: storedItemData?.name ?? `Item ${storedItem.itemID}`,
              quantity: storedItem.quantity,
              icon: composeItemIconHref(storedItem, storedItemData),
            };
          });
          tooltipData.storageItems = storedItems;
          if (storageKey === "essencePouches") {
            tooltipData.storageNotice =
              "Combined contents of all essence pouches; individual pouch contents are unavailable.";
          }
        }
      }

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
          storedItems.push({
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
          runes: storedItems.map(function getRuneTooltip(rune) {
            return { name: rune.name, quantity: rune.quantity };
          }),
        };
      }

      const previewItems = isRunePouch(item.itemID) ? storedItems : [];
      return {
        key: `${item.itemID} ${item.quantity} ${index} ${previewItems
          .map(function getStoredItemKey(storedItem) {
            return `${storedItem.id} ${storedItem.quantity}`;
          })
          .join(" ")}`,
        item,
        icon: composeItemIconHref(item, itemData),
        link: `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`,
        tooltip: storageKey && storedItems.length === 0 ? undefined : serializeTooltip(tooltipData),
        previewItems,
        hasStoredItems: Boolean(storageKey && storedItems.length > 0),
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
          <span v-if="slot.hasStoredItems" class="player-inventory-contents-indicator" aria-label="Contains items">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path fill="#211409" d="M2 3h12v11H2z" />
              <path fill="#9a6530" d="M3 4h10v3H3z" />
              <path fill="#d5aa56" d="M4 4h8v1H4z" />
              <path fill="#71401c" d="M3 8h10v5H3z" />
              <path fill="#a66b2f" d="M4 9h8v1H4z" />
              <path fill="#c18a42" d="M4 5h1v2H4zm7 0h1v2h-1zM4 10h1v3H4zm7 0h1v3h-1z" />
              <path fill="#f5d67a" d="M7 8h2v3H7z" />
            </svg>
          </span>
          <div
            v-if="slot.previewItems.length > 0"
            :class="[
              'player-inventory-pouch-container',
              { 'player-inventory-pouch-vertical': slot.previewItems.length <= 3 },
            ]"
          >
            <div v-for="storedItem in slot.previewItems" :key="storedItem.id" class="player-inventory-pouch-item-box">
              <CachedImage :alt="storedItem.name" :src="storedItem.icon" />
              <span class="player-inventory-item-quantity" :style="{ color: quantityColor(storedItem.quantity) }">
                {{ formatVeryShortQuantity(storedItem.quantity) }}
              </span>
            </div>
          </div>
        </a>
        <span v-else />
      </template>
    </div>
  </div>
</template>
