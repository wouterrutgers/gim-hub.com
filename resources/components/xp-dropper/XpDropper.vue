<script setup>
  import { skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./xp-dropper.css";

  const props = defineProps({
    xpDrops: { type: Array, default: undefined },
  });
</script>

<template>
  <div class="xp-dropper">
    <div v-for="drop in props.xpDrops" :key="`${drop.id}-${drop.creationTimeMS}`" class="xp-dropper-drop-cluster">
      <div v-for="amount in drop.amounts" :key="`${amount.skill}-${amount.amount}`" class="xp-dropper-drop">
        <CachedImage :alt="amount.skill" :src="skillIcons[amount.skill]" />
        {{ amount.amount }}
      </div>
    </div>
  </div>
</template>
