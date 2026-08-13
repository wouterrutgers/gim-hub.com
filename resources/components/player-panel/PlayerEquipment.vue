<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { useMemberEquipment, useMemberInventory, useMemberQuiver } from "../../stores/group";
  import {
    composeItemIconHref,
    formatShortQuantity,
    mappedGEPrice,
    mappedHighAlch,
    quantityColor,
  } from "../../game/items";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./player-equipment.css";

  const DIZANAS_IDS = new Set([28902, 28906, 28947, 28949, 28951, 28953, 28955, 28957]);
  const VisibleEquipmentSlots = [
    "Head",
    "Cape",
    "Amulet",
    "Weapon",
    "Body",
    "Shield",
    "Legs",
    "Gloves",
    "Boots",
    "Ring",
    "Quiver",
    "Ammo",
  ];
  const EquipmentSlotEmptyIcons = new Map([
    ["Head", "156-0.png"],
    ["Cape", "157-0.png"],
    ["Amulet", "158-0.png"],
    ["Weapon", "159-0.png"],
    ["Body", "161-0.png"],
    ["Shield", "162-0.png"],
    ["Legs", "163-0.png"],
    ["Gloves", "164-0.png"],
    ["Boots", "165-0.png"],
    ["Ring", "160-0.png"],
    ["Ammo", "166-0.png"],
    ["Quiver", "166-0.png"],
  ]);

  const props = defineProps({
    member: { type: String, required: true },
  });

  const gameDataStore = useGameDataStore();
  const equipment = useMemberEquipment(function getMember() {
    return props.member;
  });
  const inventory = useMemberInventory(function getMember() {
    return props.member;
  });
  const quiver = useMemberQuiver(function getMember() {
    return props.member;
  });

  const slots = computed(function getEquipmentSlots() {
    const hasEquippedQuiver = [...(equipment.value?.values() ?? [])].some(function isQuiver(item) {
      return DIZANAS_IDS.has(item.itemID);
    });
    const hasInventoryQuiver = [...(inventory.value?.values() ?? [])].some(function isQuiver(item) {
      return item !== undefined && DIZANAS_IDS.has(item.itemID);
    });
    const visibleSlots = [];

    for (const slot of VisibleEquipmentSlots) {
      let item = equipment.value?.get(slot);
      let present = true;
      let grayed = false;

      if (slot === "Quiver") {
        present = hasEquippedQuiver || hasInventoryQuiver;
        grayed = !hasEquippedQuiver;
        item = quiver.value?.values().next().value ?? item;
      }

      if (!present) {
        continue;
      }

      const classes = [
        `equipment-${slot.toLowerCase()}`,
        item ? "equipment-slot-filled" : "equipment-slot-empty",
        grayed ? "equipment-slot-grayed" : "",
      ].filter(Boolean);
      const emptyIcon = `/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`;

      if (!item) {
        visibleSlots.push({ slot, classes, emptyIcon });

        continue;
      }

      const itemData = gameDataStore.gameData.items?.get(item.itemID);
      visibleSlots.push({
        slot,
        classes,
        emptyIcon,
        item,
        icon: composeItemIconHref(item, itemData),
        wikiLink: `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`,
        tooltip: itemData
          ? serializeTooltip({
              type: "item",
              name: itemData.name,
              quantity: item.quantity,
              highAlch: mappedHighAlch(item.itemID, gameDataStore.gameData.items),
              gePrice: mappedGEPrice(item.itemID, gameDataStore.gameData.gePrices, gameDataStore.gameData.items),
            })
          : undefined,
      });
    }

    return visibleSlots;
  });
</script>

<template>
  <div class="player-equipment">
    <template v-for="slot in slots" :key="slot.slot">
      <a
        v-if="slot.item"
        :href="slot.wikiLink"
        target="_blank"
        rel="noopener noreferrer"
        :data-tooltip="slot.tooltip"
        :class="slot.classes"
      >
        <CachedImage v-if="!slot.icon" :alt="`empty equipment ${slot.slot} slot`" :src="slot.emptyIcon" />
        <CachedImage v-else alt="equipment" class="equipment-slot-item" :src="slot.icon" />
        <span
          v-if="slot.item.quantity > 1"
          class="player-equipment-item-quantity"
          :style="{ color: quantityColor(slot.item.quantity) }"
        >
          {{ formatShortQuantity(slot.item.quantity) }}
        </span>
      </a>
      <div v-else :class="slot.classes">
        <CachedImage :alt="`empty equipment ${slot.slot} slot`" :src="slot.emptyIcon" />
      </div>
    </template>
  </div>
</template>
