<script setup>
  import { ref, useAttrs, watch } from "vue";
  import { useImageStore } from "../../stores/images";

  defineOptions({ inheritAttrs: false });

  const props = defineProps({
    src: { type: String, required: true },
    alt: { type: String, required: true },
  });

  const imageStore = useImageStore();
  const attributes = useAttrs();

  const hashedSource = ref(null);

  watch(
    function getSource() {
      return props.src;
    },
    async function updateHashedSource(source) {
      hashedSource.value = await imageStore.getImageUrl(source);
    },
    { immediate: true },
  );
</script>

<template>
  <img v-if="hashedSource" v-bind="attributes" :src="hashedSource" :alt="props.alt" />
  <span v-else />
</template>
