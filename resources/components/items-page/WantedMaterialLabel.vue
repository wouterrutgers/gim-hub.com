<script setup>
  import CachedImage from "../cached-image/CachedImage.vue";

  defineProps({
    name: { type: String, required: true },
    icon: { type: String, required: true },
    quantity: { type: BigInt, required: true },
    required: { type: BigInt, required: true },
  });
</script>

<template>
  <span class="wanted-material-label">
    <span class="wanted-material-icon"><CachedImage :src="icon" alt="" width="18" height="18" /></span>
    <span class="wanted-material-quantity" :class="{ 'wanted-material-ready': !quantity }">
      {{ quantity ? `${quantity.toLocaleString()} × ` : "Ready" }}
    </span>
    <span class="wanted-material-info">
      <span class="wanted-material-name">{{ name }}</span>
      <span class="wanted-material-stock">
        {{ (required - quantity).toLocaleString() }} / {{ required.toLocaleString() }} available
      </span>
    </span>
  </span>
</template>
