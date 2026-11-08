<script setup>
  import { ref, watch } from "vue";
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import Modal from "../modal/Modal.vue";
  import { openModalCount } from "../modal/use-modal";
  import PlayerChooserWindow from "./PlayerChooserWindow.vue";
  import WhatsNewWindow from "./WhatsNewWindow.vue";
  import "./player-preferences.css";

  const playerPreferencesStore = usePlayerPreferencesStore();
  const activeWindow = ref();

  watch(
    [
      function chooserRequested() {
        return playerPreferencesStore.chooserOpen;
      },
      function changelogRequested() {
        return playerPreferencesStore.changelogOpen;
      },
      openModalCount,
    ],
    function waitForOtherDialogs() {
      const requested = playerPreferencesStore.chooserOpen
        ? "chooser"
        : playerPreferencesStore.changelogOpen
          ? "changelog"
          : undefined;

      if (requested === activeWindow.value) {
        return;
      }

      if (!requested || activeWindow.value) {
        activeWindow.value = undefined;

        return;
      }

      if (openModalCount.value === 0) {
        activeWindow.value = requested;
      }
    },
    { immediate: true, flush: "post" },
  );
</script>

<template>
  <Modal
    :open="activeWindow === 'chooser'"
    :component="PlayerChooserWindow"
    @close="playerPreferencesStore.closeChooser()"
  />
  <Modal
    :open="activeWindow === 'changelog'"
    :component="WhatsNewWindow"
    @close="playerPreferencesStore.dismissChangelog()"
  />
  <div v-if="playerPreferencesStore.saveError" class="player-preferences-save-error rsbackground" role="alert">
    <span>{{ playerPreferencesStore.saveError }}</span>
    <button type="button" class="men-button small" @click="playerPreferencesStore.retrySave()">Retry</button>
  </div>
  <p v-else-if="playerPreferencesStore.status" class="player-preferences-status" role="status">
    {{ playerPreferencesStore.status }}
  </p>
</template>
