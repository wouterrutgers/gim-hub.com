<script setup>
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
  const dialog = ref();
  let opener;
  const focusableSelector =
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

  onMounted(function registerModalListeners() {
    window.addEventListener("keydown", handleKeyDown);
  });

  onBeforeUnmount(function cleanupModal() {
    window.removeEventListener("keydown", handleKeyDown);
    restoreFocus();
  });

  function close() {
    emit("close");
  }

  function toggleBackgroundInert(inert) {
    document.body
      .querySelectorAll(":scope > :not(#modal, #modal-clickbox, #tooltip-container)")
      .forEach(function toggleElement(element) {
        element.inert = inert;
      });
  }

  function restoreFocus() {
    if (!opener) {
      return;
    }

    toggleBackgroundInert(false);
    opener.focus();
    opener = undefined;
  }

  function handleKeyDown(event) {
    if (!props.open) {
      return;
    }

    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const controls = [...dialog.value.querySelectorAll(focusableSelector)];
    const target = event.shiftKey ? controls.at(-1) : controls[0];
    const boundary = event.shiftKey ? controls[0] : controls.at(-1);

    if (document.activeElement === boundary || !dialog.value.contains(document.activeElement)) {
      event.preventDefault();
      target.focus();
    }
  }

  watch(
    function isOpen() {
      return props.open;
    },
    async function handleOpenState(open) {
      if (!open) {
        restoreFocus();

        return;
      }

      opener = document.activeElement;
      toggleBackgroundInert(true);
      await nextTick();
      dialog.value.querySelector(focusableSelector).focus();
    },
    { immediate: true },
  );
</script>

<template>
  <Teleport to="body">
    <template v-if="props.open">
      <div id="modal-clickbox" aria-hidden="true" @click="close" />
      <div id="modal" ref="dialog">
        <component :is="props.component" v-bind="props.componentProps" @close="close" />
      </div>
    </template>
  </Teleport>
</template>
