<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import CachedImage from "../cached-image/CachedImage.vue";

  const props = defineProps({
    name: { type: String, required: true },
  });

  const groupStore = useGroupStore();

  const hueDegrees = computed(function getHueDegrees() {
    return groupStore.memberColors.get(props.name)?.hueDegrees ?? 0;
  });
</script>

<template>
  <CachedImage
    :alt="`Player icon for ${props.name}`"
    src="/ui/player-icon.webp"
    :style="{ filter: `hue-rotate(${hueDegrees}deg) saturate(100%)` }"
    width="12"
    height="15"
  />
</template>
