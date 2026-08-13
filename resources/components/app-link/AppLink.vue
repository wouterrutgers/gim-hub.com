<script setup>
  import { RouterLink } from "vue-router";
  import "./app-link.css";

  const props = defineProps({
    href: { type: String, required: true },
    selected: { type: Boolean, default: false },
    className: { type: String, default: "" },
  });
</script>

<template>
  <RouterLink :class="['app-link', 'men-button', { active: props.selected }, props.className]" :to="props.href">
    <slot />
  </RouterLink>
</template>
