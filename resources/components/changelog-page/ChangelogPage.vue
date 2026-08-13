<script setup>
  import { onMounted, ref } from "vue";
  import { fetchChangelog } from "../../api/requests/changelog";
  import AppLink from "../app-link/AppLink.vue";
  import "./changelog-page.css";

  const props = defineProps({
    backHref: { type: String, required: true },
    backLabel: { type: String, required: true },
  });

  const entries = ref();
  const error = ref();

  onMounted(function loadChangelog() {
    fetchChangelog({ baseURL: __API_URL__ })
      .then(function storeChangelog(response) {
        entries.value = response;
      })
      .catch(function reportChangelogError(reason) {
        console.error("Failed to load changelog:", reason);
        error.value = "Failed to load changelog.";
      });
  });
</script>

<template>
  <div id="changelog-page">
    <div id="changelog-header" class="rsbackground rsborder">
      <h2>Changelog</h2>
      <div class="changelog-actions">
        <AppLink :href="props.backHref" class-name="small">{{ props.backLabel }}</AppLink>
      </div>
    </div>

    <div v-if="error" class="rsbackground rsborder changelog-entry">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="!entries" class="rsbackground rsborder changelog-entry">
      <p>Loading…</p>
    </div>

    <div v-for="entry in entries" :key="entry.id" class="rsbackground rsborder changelog-entry">
      <div class="changelog-meta">
        <div class="changelog-title">{{ entry.title }}</div>
        <div class="changelog-date">{{ entry.date }}</div>
      </div>
      <div class="changelog-markdown" v-html="entry.html" />
    </div>
  </div>
</template>
