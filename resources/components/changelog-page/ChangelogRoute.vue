<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import ChangelogPage from "./ChangelogPage.vue";

  const apiStore = useApiStore();

  const loggedIn = computed(function isLoggedIn() {
    return Boolean(apiStore.client);
  });
</script>

<template>
  <ChangelogPage :back-href="loggedIn ? '/group/items' : '/'" :back-label="loggedIn ? 'Go to group' : 'Back'" />
</template>
