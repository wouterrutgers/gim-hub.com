<script setup>
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import "../changelog-page/changelog-page.css";
  import "./player-preferences.css";

  const emit = defineEmits(["close"]);
  const playerPreferencesStore = usePlayerPreferencesStore();
</script>

<template>
  <section
    id="whats-new-window"
    class="player-preferences-window rsborder rsbackground"
    role="dialog"
    aria-modal="true"
    aria-labelledby="whats-new-title"
  >
    <div class="player-preferences-window-header">
      <h2 id="whats-new-title">What’s new</h2>
      <button type="button" class="dialog-close" aria-label="Close updates" @click="emit('close')" />
    </div>
    <article v-for="entry in playerPreferencesStore.unseenEntries" :key="entry.id" class="player-preferences-update">
      <div class="changelog-meta">
        <h3 class="changelog-title">{{ entry.title }}</h3>
        <span class="changelog-date">{{ entry.date }}</span>
      </div>
      <div class="changelog-markdown" v-html="entry.html" />
    </article>
    <p v-if="playerPreferencesStore.saveError" class="validation-error" role="alert">
      {{ playerPreferencesStore.saveError }}
    </p>
    <div class="player-preferences-window-actions">
      <button type="button" class="men-button button-primary" @click="emit('close')">Got it</button>
      <RouterLink to="/changelog" class="men-button" @click="emit('close')">View full changelog</RouterLink>
    </div>
  </section>
</template>
