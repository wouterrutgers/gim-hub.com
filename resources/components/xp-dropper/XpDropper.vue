<script setup>
  import { skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./xp-dropper.css";

  const props = defineProps({
    xpDrops: { type: Array, default: undefined },
  });
  const animationStartTimeMilliseconds = performance.now();
</script>

<template>
  <div class="xp-dropper">
    <div
      v-for="drop in props.xpDrops"
      :key="`${drop.id}-${drop.creationTimeMS}`"
      class="xp-dropper-drop-cluster"
      :style="{ animationDelay: `${Math.min(0, drop.creationTimeMS - animationStartTimeMilliseconds)}ms` }"
    >
      <div v-for="amount in drop.amounts" :key="`${amount.skill}-${amount.amount}`" class="xp-dropper-drop">
        <CachedImage :alt="amount.skill" :src="skillIcons[amount.skill]" />
        {{ amount.amount }}
      </div>
    </div>
  </div>
</template>
