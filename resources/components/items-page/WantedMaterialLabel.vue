<script setup>
  import { computed } from "vue";
  import CachedImage from "../cached-image/CachedImage.vue";

  const props = defineProps({
    name: { type: String, required: true },
    icon: { type: String, required: true },
    quantity: { type: BigInt, required: true },
    required: { type: BigInt, required: true },
    fromSurplus: { type: BigInt, required: true },
  });

  const available = computed(() => props.required - props.quantity - props.fromSurplus);
</script>

<template>
  <span class="wanted-material-label">
    <span class="wanted-material-icon"><CachedImage :src="icon" alt="" width="18" height="18" /></span>
    <span class="wanted-material-quantity" :class="{ 'wanted-material-ready': !quantity }">
      {{ quantity ? `${quantity.toLocaleString()} × ` : fromSurplus ? "Planned" : "Ready" }}
    </span>
    <span class="wanted-material-info">
      <span class="wanted-material-name">{{ name }}</span>
      <span v-if="fromSurplus" class="wanted-material-stock">
        <template v-if="available">{{ available.toLocaleString() }} available | </template>
        {{ fromSurplus.toLocaleString() }} from another batch
      </span>
      <span v-else class="wanted-material-stock">
        {{ available.toLocaleString() }} / {{ required.toLocaleString() }} available
      </span>
    </span>
  </span>
</template>
