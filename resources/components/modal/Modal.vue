<script setup>
  import { nextTick, onBeforeUnmount, onMounted, watch } from "vue";
  import "./modal.css";

  const props = defineProps({
    open: { type: Boolean, required: true },
    component: { type: [Object, Function], required: true },
    componentProps: {
      type: Object,
      default: function defaultComponentProps() {
        return {};
      },
    },
  });
  const emit = defineEmits(["close"]);

  onMounted(function registerModalListeners() {
    window.addEventListener("keydown", closeOnEscape);
  });

  onBeforeUnmount(function cleanupModal() {
    window.removeEventListener("keydown", closeOnEscape);
    toggleBackgroundInert(false);
  });

  function close() {
    emit("close");
  }

  function toggleBackgroundInert(inert) {
    document.body.querySelectorAll(":scope > :not(#modal, #modal-clickbox)").forEach(function toggleElement(element) {
      element.inert = inert;
    });
  }

  function closeOnEscape(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      close();
    }
  }

  watch(
    function isOpen() {
      return props.open;
    },
    async function handleOpenState(open) {
      toggleBackgroundInert(open);

      if (!open) {
        return;
      }

      await nextTick();

      const firstFocusable = document.querySelector(
        '#modal button, #modal [href], #modal input, #modal select, #modal textarea, #modal [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
      firstFocusable?.blur();
    },
    { immediate: true },
  );
</script>

<template>
  <Teleport to="body">
    <template v-if="props.open">
      <button id="modal-clickbox" aria-label="Exit modal" @click="close" />
      <div id="modal">
        <component :is="props.component" v-bind="props.componentProps" @close="close" />
      </div>
    </template>
  </Teleport>
</template>
