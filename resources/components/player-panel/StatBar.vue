<script setup>
  import { computed } from "vue";

  const props = defineProps({
    className: { type: String, default: "" },
    color: { type: String, required: true },
    bgColor: { type: String, required: true },
    ratio: { type: Number, default: undefined },
  });

  const background = computed(function getBackground() {
    if (props.ratio === 1) {
      return props.color;
    }

    if (props.ratio !== undefined && props.ratio >= 0) {
      const percentage = props.ratio * 100;

      return `linear-gradient(90deg, ${props.color}, ${percentage}%, ${props.bgColor} ${percentage}%)`;
    }

    return props.bgColor;
  });
</script>

<template>
  <div :style="{ background }" :class="['stat-bar', props.className]" />
</template>
