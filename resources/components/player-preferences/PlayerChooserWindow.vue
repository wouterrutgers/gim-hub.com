<script setup>
  import { ref } from "vue";
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import "./player-preferences.css";

  const emit = defineEmits(["close"]);
  const playerPreferencesStore = usePlayerPreferencesStore();
  const selectedMemberId = ref(playerPreferencesStore.selectedMemberId);

  async function usePlayer() {
    if (await playerPreferencesStore.choosePlayer(selectedMemberId.value)) {
      emit("close");
    }
  }
</script>

<template>
  <section
    id="player-chooser-window"
    class="player-preferences-window rsborder rsbackground"
    role="dialog"
    aria-modal="true"
    aria-labelledby="player-chooser-title"
    aria-describedby="player-chooser-description"
  >
    <div class="player-preferences-window-header">
      <h2 id="player-chooser-title">
        {{ playerPreferencesStore.selectedMemberId ? "Change your player" : "Which player are you?" }}
      </h2>
      <button
        v-if="playerPreferencesStore.selectedMemberId"
        type="button"
        class="dialog-close"
        aria-label="Cancel player selection"
        @click="emit('close')"
      />
    </div>
    <p id="player-chooser-description">
      We’ll remember your settings and which updates you’ve seen. Choose the same player on another device to use them
      there. You can change this at any time.
    </p>
    <form :aria-busy="playerPreferencesStore.pending" @submit.prevent="usePlayer">
      <p v-if="playerPreferencesStore.pending" tabindex="0" role="status">Loading preferences…</p>
      <fieldset class="player-chooser-options" :disabled="playerPreferencesStore.pending">
        <legend>Your player</legend>
        <label v-for="member in playerPreferencesStore.members" :key="member.id" class="player-chooser-option">
          <input v-model="selectedMemberId" type="radio" name="your-player" :value="member.id" />
          <PlayerIcon :name="member.name" aria-hidden="true" />
          <span>{{ member.name }}</span>
          <span v-if="member.id === playerPreferencesStore.selectedMemberId" class="player-chooser-current">
            Current player
          </span>
        </label>
      </fieldset>
      <p v-if="playerPreferencesStore.error" class="validation-error" role="alert">
        {{ playerPreferencesStore.error }}
      </p>
      <div class="player-preferences-window-actions">
        <button
          type="submit"
          class="men-button button-primary"
          :disabled="
            !selectedMemberId ||
            selectedMemberId === playerPreferencesStore.selectedMemberId ||
            playerPreferencesStore.pending
          "
        >
          Use this player
        </button>
        <button v-if="playerPreferencesStore.selectedMemberId" type="button" class="men-button" @click="emit('close')">
          Cancel
        </button>
      </div>
    </form>
  </section>
</template>
